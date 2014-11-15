angular.module('ight', [
                        'ui.bootstrap'
])

.constant('_', window._)
.constant('InstagramAppId', 'f05f03002ba04cb48c65c7ddae75def1')

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
			+ '<div class="date text-muted"><span class="glyphicon glyphicon-time" aria-hidden="true"></span> {{post.created_time * 1000 | date:medium}}</div>'
			+ '<div class="user text-muted"><span class="glyphicon glyphicon-user" aria-hidden="true"></span> <a ng-href="http://instagram.com/{{post.user.username}}" target="_blank">{{post.user.username}}</a></div>'
			+ '</div>'
	};
})

.service('InstagramTags', function($http, $q, InstagramAppId, _) {
	var _ = window._;
	
	var InstagramTagSummary = function(tags) {
		this.tags = _.isArray(tags) ? tags : [tags];
		
		this.untilDate = undefined;
		this.maxPosts = undefined;
		
		this.minTagIds = {};
		this.media = [];
	};	
	
	function summarize(media, progress) {
		console.log("summarizing " + media.length + " posts");
		progress(0);
		media = _.sortBy(media, function(m) { return m.created_time * 1; });
		progress(25);
		var countByUsers = _.chain(media)
				.countBy(function(m) { return m.user.username; })
				.map(function(count, username) { return { handle: username, count: count }; })
				.sortBy(function(result) { return -result.count; })
				.value();
		progress(50);
		var countByHashtags = _.chain(media)
				.pluck('tags').flatten()
				.countBy(_.identity)
				.map(function(count, tag) { return { tag: tag, count: count }; })
				.sortBy(function(result) { return -result.count; })
				.value();
		progress(75);
		var countHashtagsByUser = _.chain(media)
				.map(function(m) { return _.map(m.tags, function(t) { return m.user.username + ":" + t; }); })
				.flatten()
				.countBy(_.identity)
				.map(function(count, usertag) { return { handle: usertag.split(':')[0], tag: usertag.split(':')[1], count: count }; })
				.sortBy(function(result) { return -result.count; })
				.value();
		progress(100);
		// FIXME: retain and combine these results with existing results?
		return { 
			earliest: _.first(media),
			latest: _.last(media),
			byUsers: countByUsers, 
			byHashtags: countByHashtags, 
			hashtagsByUser: countHashtagsByUser
		};
	}
	
	InstagramTagSummary.prototype.update = function(progress, filter) {
		var deferred = $q.defer();
		var self = this;
		this.progress = progress ? progress : function(value) {};
		this.processTags(progress)
		.then(function success(media) {
			if(self.maxPosts > 0) { media = _.last(media, self.maxPosts); }
			deferred.resolve(summarize(filter ? _.filter(media, filter) : media, 
					function(v) { self.progress(90 + 10 * (v / 100)); }));
			self.progress = null;
		});
		return deferred.promise;
	};

	/**
	 * @return promise with the media
	 */
	InstagramTagSummary.prototype.processTags = function() {
		var self = this;
		return $q.all(_.map(this.tags, this.processMoreTags, this))
			.then(function success(result) {
				return self.media;
			});
	}
			
		
	/**
	 * @return promise with the media
	 */
	InstagramTagSummary.prototype.processMoreTags = function(tag) {
		var self = this;
		// Instagram tagIds are in microseconds
		if((this.untilDate && this.minTagIds[tag] > 0 && (this.minTagIds[tag] / 1000) < this.untilDate.getTime())
				|| (this.maxPosts > 0 && this.media.length >= this.maxPosts)) {
			console.log(tag + ": curtailing query with " + this.media.length + " posts total");	
			return $q.when(this.media);
		}
		var params = { client_id: InstagramAppId };
		if(this.minTagIds[tag] > 0) { params.max_tag_id = this.minTagIds[tag]; }
		if(this.maxPosts > 0) { params.count = (this.maxPosts - this.media.length).toString(); }
		return $http.jsonp('https://api.instagram.com/v1/tags/' + tag + '/media/recent?callback=JSON_CALLBACK', {
				headers: {"Accept":undefined},
				params: params
			}).then(
				function success(response) {					
					self.media = response.data.data.concat(self.media); 
					if(self.maxPosts > 0) {
						self.progress(90 * self.media.length / self.maxPosts);
					} else if(self.untilDate && response.data.pagination.next_max_tag_id) {
						var d = new Date().getTime();
						var until = self.untilDate.getTime();
						var position = response.data.pagination.next_max_tag_id / 1000;
						self.progress(90 * (d - position) / (d - until));
					}
					if(response.data.pagination && (!self.minTagIds[tag] || response.data.pagination.next_max_tag_id < self.minTagIds[tag])) {
						self.minTagIds[tag] = response.data.pagination.next_max_tag_id;
						return self.processMoreTags(tag);
					} else {
						console.log(self.tag + ": no more posts; " + self.media.length + " posts total");
						console.dir(response);
						return $q.when(self.media);
					}
				},
				function error(err) {
					// return what we've got so far
					console.log("error fetching data: " + JSON.stringify(err));
					return self.media;
				});	
	}
	
	
	return {
		summarizeTags: function(tags) {
			if(!_.isArray(tags)) {
				tags = tags.split(/[, #]+/);
			}
			return new InstagramTagSummary(tags);
		},
	
		/**
		 * Resolve the provided handle to the corresponding Instagram id,
		 * a stable numeric value good for the life of the account. 
		 * @param handle the Instagram handle (e.g., 'tatteredego')
		 * @returns a promise that will  be resolved with either the
		 * 	id or {@code undefined}.
		 * 	
		 */
		lookupUserId: function(handle) {
			var result = $q.defer();
			$http.get('https://api.instagram.com/v1/users/search',
				{
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: {
						callback: '?',
						client_id: InstagramAppId,
						q: handle,
						count: 1
					}}).then(
						function success(response) {
							result.resolve(response.data.length == 0 ?
									undefined : response.data[0].id);
						},
						function error(err) {
							console.log("Error looking up Instagram handle '" + handle + "': " + err);
							result.reject(err);
						});
				return result.promise;
		}

//		processUser: function(handle, date, maximum) {
//			$http.get('https://api.instagram.com/v1/users/' + igUserId + '/media/recent',
//				{
//							headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//							body: {
//								callback: '?',
//								client_id: InstagramAppId,
//								q: req.params.user,
//								count: 1
//							}}).then(
//								function success(response) {},
//								function error(err) {});	
//		}
	};
});