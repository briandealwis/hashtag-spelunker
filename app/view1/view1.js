'use strict';

angular.module('myApp.view1', ['ngRoute', 'ight', 'ui.bootstrap'])

.config(function($routeProvider) {
  $routeProvider.when('/view1', {
    templateUrl: 'view1/view1.html',
    controller: 'View1Ctrl'
  });
})

.controller('View1Ctrl', function($scope, $modal, InstagramTags) {
	console.log("about to invoke summarizer");
	$scope.tags = "";
	$scope.maxPosts = 0;
	$scope.untilDate = new Date().toISOString().slice(0,10);
	$scope.pluck = 100;
	var summary;
	
	function pluckTop(results, count) {
		var _ = window._;
		return _.chain(results)
				.sortBy(function(r) { return -r.count; })
				.first(count).value();
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

	function showPosts(title, posts) {
		console.log("show posts: " + title);
		$scope.highlightText = title;
		$scope.highlightedPosts = posts;
		var newScope = $scope.$new();
		newScope.title = title;
		newScope.posts = posts;
		$modal.open({
//			resolve: {
//				title: function() { return title; },
//				posts: function() { return posts; }
//			},
			scope: newScope,
			//controller: 'View1Ctrl',
			template: 
						'<div class="modal-header"><h3>{{title}}</h3></div>'
						+ '<div class="modal-body"><ul class="list-inline">'
						+ '<li ng-repeat="post in posts" style="vertical-align: top;">'
						+ '  <ig-compact content="post"></ig-compact>'
						+ '</li>'
						+ '</div>'
						+ '<div class="modal-footer"><button class="btn btn-primary" ng-click="$close()">Close</button></div>'
		});
	}
	
	$scope.showPostsFromUser = function(username) {
		showPosts("Posts from " + username,
			_.filter(summary.media, function(m) { return m.user.username == username; }));
	};
	$scope.showPostsWithTag = function(tag) {
		showPosts('Posts with #' + $scope.hashtag + " #" + tag,
			_.filter(summary.media, function(m) { return _.contains(m.tags, tag); }));
	};
	$scope.showPostsFromUserWithTag = function(handle, tag) {
		showPosts('From ' + handle + " with #" + tag, 
				_.filter(summary.media,
						function(m) { return m.user.username == handle
							&& _.contains(m.tags, tag); }));
	};
	
	$scope.run = function() {
		$scope.results = null;

		if(_.isEmpty($scope.tags)) {
			summary = null;
		} else {
			if(!summary || $scope.originalTags != $scope.tags) {
				$scope.originalTags = $scope.tags;
				summary = InstagramTags.summarizeTags($scope.tags);
			}
			if($scope.maxPosts > 0) {
				summary.maxPosts = $scope.maxPosts
			}
			if($scope.untilDate) {
				summary.untilDate = new Date($scope.untilDate);
			}
		}
		update();
	};
});