'use strict';

angular.module('myApp.view1', ['ngRoute', 'ight'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/view1', {
    templateUrl: 'view1/view1.html',
    controller: 'View1Ctrl'
  });
}])

.controller('View1Ctrl', function($scope, InstagramTags) {
	console.log("about to invoke summarizer");
	$scope.hashtag = null;
	$scope.maxPosts = 20;
	$scope.untilDate = null;
	$scope.pluck = 100;
	var summary;
	
	function pluckTop(bag, count) {
		var _ = window._;
		return _.chain(bag).pairs().sortBy(function(p) { return -p[1]; }).first(count).value();
	}
	
	function update() {
		if(summary) {
			summary.update().then(
				function success(results) {
					$scope.results = {
							media: summary.media,
							earliest: results.earliest,
							latest: results.latest,
							byUsers: pluckTop(results.byUsers, $scope.pluck), 
							byHashtags: pluckTop(results.byHashtags, $scope.pluck), 
							hashtagsByUser: pluckTop(results.hashtagsByUser, $scope.pluck)
					};
					console.dir($scope.results);
				});
		} else {
			$scope.results = null;
		}
	}

	$scope.extractUsername = function(usertag) {
		return usertag.split(':')[0];
	};
	
	$scope.showPostsFromUser = function(username) {
		$scope.highlightText = "Posts from " + username;
		$scope.highlightedPosts = _.filter(summary.media,
			function(m) { return m.user.username == username; });
	};
	$scope.showPostsWithTag = function(tag) {
		$scope.highlightText = 'Posts with #' + $scope.hashtag + " #" + tag;
		$scope.highlightedPosts = _.filter(summary.media,
			function(m) { return _.contains(m.tags, tag); });
	};
	$scope.showPostsFromUserWithTag = function(userTag) {
		var username = userTag.split(':')[0];
		var tag = userTag.split(':')[1];
		$scope.highlightText = 'From ' + username + " with #" + tag;
		$scope.highlightedPosts = _.filter(summary.media,
			function(m) { return m.user.username == username
				&& _.contains(m.tags, tag); });
	};
	
	$scope.run = function() {
		$scope.results = null;

		if(!$scope.hashtag) {
			summary = null;
		} else {
			if(!summary || summary.tag != $scope.hashtag) {
				summary = InstagramTags.summarizeTag($scope.hashtag);
			}
			summary.maxPosts = $scope.maxPosts;
			summary.untilDate = $scope.untilDate;
		}
		update();
	};
});