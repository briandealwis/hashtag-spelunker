angular.module('ight', [])
.constant('_', window._)
.constant('InstagramAppId', 'f05f03002ba04cb48c65c7ddae75def1')

.directive('igCompact', function($compile) {
	return {
		restrict: 'E',
		scope: { post: '=content' },
		template: 
			'<div class="ig-compact">'
			+ '<a href="{{post.link}}">' 
			+ '<img src="{{post.images.thumbnail.url}}">'
			+ '</a>'
			+ '<div class="date">{{post.created_time * 1000 | date:medium}}</div>'
			+ '<div class="user"><a ng-href="http://instagram.com/{{post.user.username}}">{{post.user.username}}</a></div>'
			+ '<div class="caption">{{post.caption.text}}</div>'
			+ '</div>'
	};
})

.service('InstagramTags', function($http, $q, InstagramAppId, _) {
	var _ = window._;
	
	var InstagramTagSummary = function(tag) {
		this.tag = tag;
		
		this.untilDate = undefined;
		this.maxPosts = undefined;
		
		this.minTagId = undefined;
		this.maxTagId = undefined;
		this.media = [];
	};	
	
	function summarize(media) {
		console.log("summarize: " + media.length);
		media = _.sortBy(media, function(m) { return m.created_time * 1; });
		var countByUsers = _.countBy(media, function(m) { return m.user.username; });
		var countByHashtags = _.chain(media).pluck('tags').flatten().countBy(_.identity).value();
		var countHashtagsByUser = _.chain(media).map(function(m) {
				return _.map(m.tags, function(t) { return m.user.username + ":" + t; });
			}).flatten().countBy(_.identity).value();
		// FIXME: retain and combine these results with existing results?
		return { 
			earliest: _.first(media),
			latest: _.last(media),
			byUsers: countByUsers, 
			byHashtags: countByHashtags, 
			hashtagsByUser: countHashtagsByUser
		};
	}
	
	InstagramTagSummary.prototype.update = function(filter) {
		var deferred = $q.defer();
		this.processMoreTags()
		.then(function success(media) {
			deferred.resolve(summarize(filter ? _.filter(media, filter) : media));
		});
		return deferred.promise;
	};
	
	/**
	 * @return promise with the media
	 */
	InstagramTagSummary.prototype.processMoreTags = function() {
		var self = this;
		// Instagram tagIds are in microseconds
		if((this.untilDate && this.minTagId > 0 && (this.minTagId / 1000) < this.untilDate.getTime())
				|| (this.maxPosts > 0 && this.media.length > this.maxPosts)) {
			console.log(this.tag + ": curtailing query with " + this.media.length + " posts total");	
			return $q.when(this.media);
		}
		var params = { client_id: InstagramAppId };
		if(this.minTagId > 0) { params.max_tag_id = this.minTagId; }
		if(this.maxPosts > 0) { params.count = (this.maxPosts - this.media.length).toString(); }
		return $http.jsonp('https://api.instagram.com/v1/tags/' + this.tag + '/media/recent?callback=JSON_CALLBACK', {
				headers: {"Accept":undefined},
				params: params
			}).then(
				function success(response) {
					self.media = response.data.data.concat(self.media); 
					if(response.data.pagination && (!self.minTagId || response.data.pagination.next_max_tag_id < self.minTagId)) {
						self.minTagId = response.data.pagination.next_max_tag_id;
						return self.processMoreTags();
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
		summarizeTag: function(tag) {
			return new InstagramTagSummary(tag);
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