angular.module('ight', [])
.constant('_', window._)
.constant('InstagramAppId', 'f05f03002ba04cb48c65c7ddae75def1')

.service('InstagramTags', function($http, $q, InstagramAppId, _) {
	var initialTag;
	var minTagId = -1;
	var maxTagId = -1;
	
	// the results
	var userList;
	var hashTags;
	var userByTags;
	
	var _ = window._;
	
	function processMedia(media) {
		console.log("processMedia: " + media.length);
		var countByUsers = _.countBy(media, function(m) { return m.user.username + "[" + m.user.id + "]"; });
		var countByHashtags = _.chain(media).pluck('tags').flatten().countBy(_.identity).value();
		var countHashtagsByUser = _.chain(media).map(function(m) {
				return _.map(m.tags, function(t) { return m.user.id + "[" + m.user.username + "]:" + t; });
			}).flatten().countBy(_.identity).value();
		// FIXME: SHOULD try to figure out how to combine these results with existing results
		return { 
			byUsers: countByUsers, 
			byHashtags: countByHashtags, 
			hashtagsByUser: countHashtagsByUser
		};
	}
	
	/**
	 * @return promise with the media
	 */
	function processTagUntil(tag, untilDate, maximum, media, minTagId) {
		// Instagram tagIds are in microseconds
		if(!minTagId
				|| (untilDate && minTagId > 0 && (minTagId / 1000) < untilDate.getTime())
				|| (maximum > 0 && media.length > maximum)) {
			return $q.when(media);
		}
		console.log("about to fetch more tags: min_tag_id=" + minTagId);
		return $http.jsonp('https://api.instagram.com/v1/tags/' + tag + '/media/recent?callback=JSON_CALLBACK', {
			headers: {"Accept":undefined},
			params: {
				//callback: '?',
				client_id: InstagramAppId,
				min_tag_id: (minTagId > 0 ? minTagId : undefined),
				count: (maximum > 0 ? (maximum - media.length).toString() : undefined)
			}}).then(
				function success(response) {
					return processTagUntil(tag, untilDate, maximum,
						response.data.data.concat(media), response.data.pagination.min_tag_id);
				},
				function error(err) {
					// return what we've got so far
					console.log("error fetching data: " + JSON.stringify(err));
					return media;
				});	
	}
	
	
	return {
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
							response.resolve(response.data.length == 0 ?
									undefined : response.data[0].id);
						},
						function error(err) {
							console.log("Error looking up Instagram handle '" + handle + "': " + err);
							result.reject(err);
						});
				return result.promise;
		},

		processUser: function(handle, date, maximum) {
			$http.get('https://api.instagram.com/v1/users/' + igUserId + '/media/recent',
				{
							headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
							body: {
								callback: '?',
								client_id: InstagramAppId,
								q: req.params.user,
								count: 1
							}}).then(
								function success(response) {},
								function error(err) {});	
		},

		summarizeTag: function(tag, date, maximum) {
			var deferred = $q.defer();
			processTagUntil(tag, date, maximum, [], -1)
			.then(function success(media) {
				deferred.resolve(processMedia(media));
			});
			return deferred.promise;
		}
	};
});