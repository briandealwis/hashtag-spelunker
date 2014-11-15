'use strict';

angular.module('myApp.view1', ['ngRoute', 'ight', 'ui.bootstrap'])

.config(function($routeProvider) {
  $routeProvider.when('/view1', {
    templateUrl: 'view1/view1.html',
    controller: 'View1Ctrl'
  });
})

.controller('PostsCtrl', function($scope) {
})


.controller('View1Ctrl', function($scope, $modal, InstagramTags) {
	console.log("about to invoke summarizer");
	$scope.tags = "";
	$scope.maxPosts = 200;
	$scope.untilDate = new Date().toISOString().slice(0,10);
	$scope.pluck = 100;
	var summary;
	
	function update() {
		if(summary) {
			$scope.progress = 0;
			$scope.running = true;
			summary.update(function(value) {
				$scope.progress = Math.floor(value);
			}).then(
				function success(results) {
					$scope.results = {
							media: summary.media,
							earliest: results.earliest,
							latest: results.latest,
							byUsers: results.byUsers, 
							byHashtags: results.byHashtags, 
							hashtagsByUser: results.hashtagsByUser
					};
				}, function error(err) {
					console.log("UHOH: " + err);
				}).finally(function() {
					$scope.running = false;
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
			controller: 'PostsCtrl',
			template: 
						'<div class="modal-header"><h4>{{title}}</h4></div>'
						+ '<div class="modal-body">'
						+ '<ul class="list-inline">'
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
		showPosts('Posts with  #' + tag,
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