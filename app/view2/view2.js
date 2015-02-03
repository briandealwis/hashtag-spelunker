'use strict';

angular.module('myApp.view2', ['ngRoute', 'myApp.services', 'myApp.posts', 'ui.bootstrap'])

.config(function($routeProvider) {
  $routeProvider.when('/view2', {
    templateUrl: 'view2/view2.html',
    controller: 'View2Ctrl'
  });
})


.controller('View2Ctrl', function($scope, _, $modal, InstagramTags, PostsViewer) {
	console.log("about to invoke summarizer");
	$scope.position = { latitude: 43.7, longitude: -79.4, distance: 1000 };
	$scope.tags = "";
	$scope.maxPosts = 200;
	$scope.untilDate = new Date().toISOString().slice(0,10);
	$scope.pluck = 100;
	var summary = InstagramTags.create();
	var tagExpr;
	
	$scope.run = function() {
		$scope.results = null;
		
		try {					
			$scope.tagsErrorMessage = null;
			tagExpr = $scope.tags ? tagexprparser.parse($scope.tags) : null;
		} catch(e) {
			return $scope.tagsErrorMessage = e.toString();
		}
		summary.position = $scope.position;
		summary.minFollowers = $scope.minFollowers;
		summary.maxPosts = $scope.maxPosts;
		summary.untilDate = $scope.untilDate ? new Date($scope.untilDate) : undefined;
	
		$scope.progress = 0;
		$scope.running = true;
		return summary.update(function(value) { $scope.progress = Math.floor(value); },
				function(post) { return tagExpr ? tagExpr.matches(post) : true; })
		.then(function success(results) {
			console.log("update(): setting $scope.results");
			$scope.results = results;
		}, function error(err) {
			alert("An error occurred: " + JSON.stringify(err));
		}).finally(function() {
			$scope.running = false;
		});
	};
	
	$scope.showPostsFromUser = function(handle) {
		return summary.lookupUserHandle(handle)
		.then(function(user) {
			PostsViewer.showPosts("Posts from " + handle,
					_.filter($scope.results.media, function(m) { return m.user.username == handle; }),
					user);
		});
	};
	
	$scope.showPostsWithTag = function(tag) {
		return PostsViewer.showPosts('Posts with  #' + tag,
			_.filter($scope.results.media, function(m) { return _.contains(m.tags, tag); }));
	};
	
	$scope.showPostsFromUserWithTag = function(handle, tag) {
		return summary.lookupUserHandle(handle)
		.then(function(user) {			
			PostsViewer.showPosts('From ' + handle + " with #" + tag, 
					_.filter($scope.results.media,
							function(m) { return m.user.username == handle
						&& _.contains(m.tags, tag); }),
					user);
		});
	};
});