angular.module('myApp.services', [
                        'ui.bootstrap'
])

.constant('_', window._)
.constant('InstagramAppId', 'f62682a68d99471892878374803e6ac8')

.directive('igCompact', function($compile) {
	return {
		restrict: 'E',
		scope: { post: '=content' },
		template: 
			'<div class="ig-compact ">'
			+ '<a href="{{post.link}}" target="_blank">' 
			+ '<div popover="{{post.caption.text}}" popover-trigger="mouseenter">'
			+ '<img ng-src="{{post.images.thumbnail.url}}" ng-alt="{{post.caption.text}}">'
			+ '</div>'
			+ '</a>'
			+ '<small>'
			+ '<div class="details text-muted">'
			+ '<span><span class="glyphicon glyphicon-time" aria-hidden="true"></span> {{post.created_time * 1000 | date:medium}}</span>'
			+ '  <span ng-if="post.likes.count > 0"><a href="{{post.link}}" target="_blank"><span class="glyphicon glyphicon-heart" aria-hidden="true"></span> {{post.likes.count}}</a></span>'
			+ '  <span ng-if="post.comments.count > 0"><a href="{{post.link}}" target="_blank"><span class="glyphicon glyphicon-fire" aria-hidden="true"></span> {{post.comments.count}}</a></span>'
			+ '</div>'
			+ '<div class="user text-muted"><span class="glyphicon glyphicon-user" aria-hidden="true"></span> <a ng-href="http://instagram.com/{{post.user.username}}" target="_blank">{{post.user.username}}</a></div>'
			+ '</small>'
			+ '</div>'
	};
})

.service('InstagramTags', function($http, $q, InstagramAppId, _) {
	
	function descendingSortKey(count, secondary) {
		// invert the count as a negative integer, padded with 0s for sort
		return (100000 - count).toString() + secondary;
	}
	
	var InstagramTagSummary = function() {
		
		this.untilDate = undefined;
		this.maxPosts = undefined;
		this.minFollowers = undefined;
		
		this._posts = {};
		
		this.tags = undefined;
		this._nextMaxTagIds = {};
		this._taggedPostCounts = {};
		
		this.position = undefined;
		this.positionPostCounts = undefined;
		
		this.usersById = undefined;
	};	
	
	function summarize(media, progress) {
		console.log("summarizing " + media.length + " posts");
		progress(0);
		var countByUsers = _.chain(media)
				.countBy(function(m) { return m.user.username; })
				.map(function(count, username) { return { handle: username, count: count }; })
				.sortBy(function(result) { return descendingSortKey(result.count, result.handle); })
				.value();
		progress(33);
		var countByHashtags = _.chain(media)
				.pluck('tags').flatten()
				.countBy(_.identity)
				.map(function(count, tag) { return { tag: tag, count: count }; })
				.sortBy(function(result) { return descendingSortKey(result.count, result.tag); })
				.value();
		progress(66);
		var countHashtagsByUser = _.chain(media)
				.map(function(m) { return _.map(m.tags, function(t) { return m.user.username + ":" + t; }); })
				.flatten()
				.countBy(_.identity)
				.map(function(count, usertag) { return { handle: usertag.split(':')[0], tag: usertag.split(':')[1], count: count }; })
				.sortBy(function(result) { return descendingSortKey(result.count, result.handle + result.tag); })
				.value();
		progress(100);
		// Note that we sort the media in inverse order 
		return {
			media: media,
			earliest: _.last(media),
			latest: _.first(media),
			byUsers: countByUsers, 
			byHashtags: countByHashtags, 
			hashtagsByUser: countHashtagsByUser
		};
	}
	
	InstagramTagSummary.prototype.update = function(progress, filter) {
		var self = this;
		var P = function(start, count) {
			return function(v) { if(progress) progress(start + (v * count / 100)); }};
		return (this.tags ? this._processTaggedPosts(P(0, 50)) : this._processPostsWithPosition(P(0, 50)))
		.then(function success(posts) {
			var flow = _.chain(posts)
				.values()
				.sortBy(function(m) { return -m.created_time * 1; });
			if(filter) { flow = flow.filter(filter); }
			if(self.maxPosts > 0) { flow = flow.first(self.maxPosts); }
			return flow.value();
		})
		.then(function(posts) {
			return self.minFollowers > 0 ? self._processUsers(posts, P(50, 40)) : posts; 
		})
		.then(function(posts) {
			return summarize(posts, P(90, 10));
		});
	};

	/**
	 * @return promise with the media
	 */
	InstagramTagSummary.prototype._processPostsWithPosition = function(progress) {
		var self = this;
		var untilDateAsTs = this.untilDate ? Math.floor(this.untilDate.getTime() / 1000) : 0;
		if(!this._positionPostCount) { this._positionPostCount = 0; }
		if(this.untilDate && this._nextPositionMaxTs > 0 && this._nextPositionMaxTs < untilDateAsTs) {
			console.log("curtailing position query as hit until date with " + this._positionPostCount + " posts total");
			return $q.when(self._posts);
		} else if(this.maxPosts > 0 && this._positionPostCount >= this.maxPosts) {
			console.log("curtailing position query with " + this._positionPostCount + " posts total");
			return $q.when(self._posts);
		}
		var params = { 
				client_id: InstagramAppId,
				lat: this.position.latitude,
				lng: this.position.longitude,
				distance: this.position.distance
		};
		if(this.untilDate) {
			params.min_timestamp = untilDateAsTs;
		}
		if(this._nextPositionMaxTs > 0) { params.max_timestamp = this._nextPositionMaxTs; }
		if(this.maxPosts > 0) { params.count = (this.maxPosts - this._positionPostCount).toString(); }
		return $http.jsonp('https://api.instagram.com/v1/media/search?callback=JSON_CALLBACK', {
				headers: {"Accept":undefined},
				params: params
			}).then(
				function success(response) {
					if(response.data.meta.code == 400) {
						console.log("error: could not fetch position details: " + JSON.stringify(response.data.meta));
						return $q.reject(response.data.meta);
					}
					
					console.log("position query: received " + response.data.data.length + " posts");
					if(response.data.data.length == 0) {
						return $q.when(self._posts);
					}
					var earliestCreationTs = response.data.data[0].created_time;
					for(var i = 0; i < response.data.data.length; i++) {
						var post = response.data.data[i];
						/* A post with a later comment adding the searched-for tag will effectively 
						 * be dated by the date of that comment rather than the post creation date.
						 * If this behaviour is considered undesirable, could filter based on that. */
						//if(response.data.pagination.next_max_tag_id && post.created_time 
						//		&& post.created_time <  Math.floor(response.data.pagination.next_max_tag_id / 1000000)) {
						//	console.dir(post);
						//}
						
						if(!self._posts[post.id]) {
							self._posts[post.id] = post;
						}
						self._positionPostCount++;
						earliestCreationTs = Math.min(earliestCreationTs, post.created_time);
					}
					
					if(self.maxPosts > 0) {
						progress(100 * self._positionPostCount / self.maxPosts);
					} else if(self.untilDate) {
						var d = new Date().getTime() / 1000;
						var position = earliestCreationTs;
						progress(100 * (d - position) / (d - untilDateAsTs));
					}
					// while there's still more posts available...
					if(self._nextPositionMaxTs == earliestCreationTs) {
						return $q.when(self._posts);
					} else {						
						self._nextPositionMaxTs = earliestCreationTs;
						return self._processPostsWithPosition(progress);
					}
				},
				function error(err) {
					// return what we've got so far
					console.log("error fetching data: " + JSON.stringify(err));
					return $q.when(self._posts);
				});	
	}

	/**
	 * @return promise with the media
	 */
	InstagramTagSummary.prototype._processTaggedPosts = function(progress) {
		var self = this;
		var tagIndex = 0;

		return continueProcessing();
		function continueProcessing() {
			if(tagIndex == self.tags.length) { return self._posts; }
			return self._fetchPostsWithTag(self.tags[tagIndex++],
					function(v) { if(progress) progress(v * tagIndex / self.tags.length); })
			.then(function success(posts) {
				return continueProcessing();
			});
		}
	}
			
	
	/**
	 * @return promise with the media or {null} if complete or error occurred
	 */
	InstagramTagSummary.prototype._fetchPostsWithTag = function(tag, progress) {
		var self = this;
		if(!this._taggedPostCounts[tag]) { this._taggedPostCounts[tag] = 0; }
		// Instagram tagIds are in microseconds
		if(this.untilDate && this._nextMaxTagIds[tag] > 0 && (this._nextMaxTagIds[tag] / 1000) < this.untilDate.getTime()) {
			console.log(tag + ": curtailing query as hit until date with " + this._taggedPostCounts[tag] + " posts total");
			return $q.when(null);
		} else if(this.maxPosts > 0 && this._taggedPostCounts[tag] >= this.maxPosts) {
			console.log(tag + ": curtailing query with " + this._taggedPostCounts[tag] + " posts total");
			return $q.when(null);
		}
		var params = { client_id: InstagramAppId };
		if(this._nextMaxTagIds[tag] > 0) { params.max_tag_id = this._nextMaxTagIds[tag]; }
		if(this.maxPosts > 0) { params.count = (this.maxPosts - this._taggedPostCounts[tag]).toString(); }
		return $http.jsonp('https://api.instagram.com/v1/tags/' + tag + '/media/recent?callback=JSON_CALLBACK', {
				headers: {"Accept":undefined},
				params: params
			}).then(
				function success(response) {
					if(response.data.meta.code == 400) {
						console.log("error: could not fetch tag details: " + JSON.stringify(response.data.meta));
						return $q.reject(response.data.meta);
					}
					
					console.log(tag + ": received " + response.data.data.length + " posts [min:"
						+ (response.data.pagination.min_tag_id ?  response.data.pagination.min_tag_id : "?") + ", max:"
						+ (response.data.pagination.max_tag_id ?  response.data.pagination.max_tag_id : "?") + "]");
					for(var i = 0; i < response.data.data.length; i++) {
						var post = response.data.data[i];
						/* A post with a later comment adding the searched-for tag will effectively 
						 * be dated by the date of that comment rather than the post creation date.
						 * If this behaviour is considered undesirable, could filter based on that. */
						//if(response.data.pagination.next_max_tag_id && post.created_time 
						//		&& post.created_time <  Math.floor(response.data.pagination.next_max_tag_id / 1000000)) {
						//	console.dir(post);
						//}
						
						if(!self._posts[post.id]) {
							self._posts[post.id] = post;
						}
						self._taggedPostCounts[tag]++;
					}
					
					if(self.maxPosts > 0) {
						progress(100 * self._taggedPostCounts[tag] / self.maxPosts);
					} else if(self.untilDate && response.data.pagination.min_tag_id) {
						var d = new Date().getTime();
						var until = self.untilDate.getTime();
						var position = response.data.pagination.min_tag_id / 1000;
						progress(100 * (d - position) / (d - until));
					}
					// while there's still more posts available...
					if(response.data.pagination && response.data.pagination.next_max_tag_id) {
						self._nextMaxTagIds[tag] = response.data.pagination.next_max_tag_id;
						return self._fetchPostsWithTag(tag, progress);
					} else {
						console.log(self.tag + ": no more posts; " + self._taggedPostCounts[tag] + " posts total");
						return $q.when(null);
					}
				},
				function error(err) {
					// return what we've got so far
					console.log("error fetching data: " + JSON.stringify(err));
					return $q.when(null);
				});	
	};
	
	/**
	 * @return promise with the media
	 */
	InstagramTagSummary.prototype._processUsers = function(posts, progress) {
		var self = this;

		if(!this.minFollowers) {
			return $q.when(posts);
		}
		if(!this.usersById) {
			this.usersById = {};
		}
		var missing = {};
		_.forEach(posts, function(post) {
			var userId = '' + post.user.id;	// convert to string
			if(!self.usersById[userId] && !missing[userId]) {
				missing[userId] = userId;
			}
		});
		missing = _.keys(missing);
		var total = missing.length;
		var count = 0;
		console.log("Starting to fetch info on " + total + " users");
		return processNextUser()
		.then(function() {
			return posts.filter(function(post) { 
				return self.usersById[post.user.id].counts.followed_by >= self.minFollowers; 
			});
		});
		
		function processNextUser() {
			if(missing.length == 0) { 
				console.log("Finished fetching using user info");
				progress(100);
				return $q.when(null);
			}
			var userId = missing.pop();
			var params = { client_id: InstagramAppId };
			return $http.jsonp('https://api.instagram.com/v1/users/' + userId + '?callback=JSON_CALLBACK', {
					headers: {"Accept":undefined},
					params: params
				}).then(function success(response) {
					if(response.data.meta.code == 400) {
						console.log("error: could not fetch user details: " + JSON.stringify(response.data.meta));
						return $q.reject(response.data.meta);
					}
					progress(++count * 100 / total);
					self.usersById[response.data.data.id] = response.data.data;
					console.log("Fetched " + response.data.data.username + ": " + response.data.data.counts);
					return processNextUser();
				});
		};
	};
	
	/**
	 * Resolve the user details for the corresponding Instagram id,
	 * a stable numeric value good for the life of the account. 
	 * @param id the Instagram id (e.g., 141623523)
	 * @returns a promise that will  be resolved with either the
	 * 	Instagram user object or {@code undefined}.
	 * 	
	 */
	InstagramTagSummary.prototype.lookupUserId = function(id) {
		var self = this;
		if(this.usersById && this.usersById[id]) {
			return $q.when(this.usersById[id]);
		}
		var params = {
				client_id: InstagramAppId
		};
		return $http.jsonp('https://api.instagram.com/v1/users/' + id + '?callback=JSON_CALLBACK',
			{
				headers: {"Accept":undefined},
				params: params
			}).then(function success(response) {
				if(response.data.meta.code == 400) {
					console.log("error: could not fetch tag details: " + JSON.stringify(response.data.meta));
					return $q.when(undefined);
				}
				if(!self.usersById) {
					self.usersById = {};
				}
				self.usersById[id] = response.data.data;	// stash it away
				return response.data.data;
			},
			function error(err) {
				console.log("Error looking up Instagram id '" + id + "': " + err);
			});
	},

	/**
	 * Resolve the user details for the corresponding Instagram handle,
	 * a stable numeric value good for the life of the account. 
	 * @param id the Instagram id (e.g., 141623523)
	 * @returns a promise that will  be resolved with either the
	 * 	Instagram user object or {@code undefined}.
	 * 	
	 */
	InstagramTagSummary.prototype.lookupUserHandle = function(handle) {
		var self = this;
		if(this.usersById) {
			var found = null;
			_.each(this.usersById, function(user) {
				if(_.isEqual(handle, user.username)) {
					found = user;
				}
			});
			if(found) {
				return $q.when(found);
			}
		}
		var params = {
			client_id: InstagramAppId,
			q: handle,
			count: 1
		};
		return $http.jsonp('https://api.instagram.com/v1/users/search?callback=JSON_CALLBACK',
			{
				headers: {"Accept":undefined},
				params: params
			}).then(function success(response) {
						if(response.data.meta.code == 400) {
							console.log("error: could not fetch tag details: " + JSON.stringify(response.data.meta));
							return undefined;
						}
						// /users/search doesn't return as much information 
						return self.lookupUserId(response.data.data[0].id);
					},
					function error(err) {
						console.log("Error looking up Instagram handle '" + handle + "': " + err);
					});
	}

	return {
		create: function() {
			return new InstagramTagSummary([]);
		},
	};
});
