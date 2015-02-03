'use strict';

angular.module('myApp.posts', ['ui.bootstrap'])

.service('PostsViewer', function($rootScope, _, $modal) {
	return {
		showPosts: showPosts
	};

	function showPosts(title, posts, user) {
		console.log("show posts: " + title);
		var newScope = $rootScope.$new();
		newScope.title = title;
		newScope.posts = posts;
		newScope.user = user;
		$modal.open({
//			resolve: {
//				title: function() { return title; },
//				posts: function() { return posts; }
//			},
			scope: newScope,
			controller: 'PostsCtrl',
			template: 
						'<div class="modal-header">'
						+ '<h4>{{title}} ({{posts.length}})</h4>'
						+ '<h5 ng-if="user">'
						+ '{{user.username}} <span ng-show="user.full_name">({{user.full_name}})</span>: '
						+ '{{user.counts.media}} posts, {{user.counts.followed_by}} followers'
						+ '</h5>'
						+ '<h6 ng-if="user.bio">'
						+ '{{user.bio}}'
						+ '</h6>'
						+'</div>'
						+ '<div class="modal-body">'
						+ '<p><label>Filter:</label> <input type="search" ng-model="search.tags" placeholder="filter by tag"></p>'
						+ '<p>'
						+ '  <a href class="btn btn-xs" ng-repeat="tag in uniqueTags" ng-click="toggleTag(tag)" ng-class="tagButtonClass(tag)">'
						+ '{{tag}} ({{count(tag)}})'
						+ '</a>'
						+ '</p>'
						+ '<ul class="list-inline">'
						+ '<li ng-repeat="post in posts | filter:selectedTags | filter:search" style="vertical-align: top;">'
						+ '  <ig-compact content="post"></ig-compact>'
						+ '</li>'
						+ '</div>'
						+ '<div class="modal-footer"><button class="btn btn-primary" ng-click="$close()">Close</button></div>'
		});
	}
	
})

.controller('PostsCtrl', function($scope, _) {
	function descendingSortKey(count, secondary) {
		// encode the count as a negative integer, padded with 0s for sort
		return (100000 - count).toString() + secondary;
	}

	$scope.countByHashtags 	= _.chain($scope.posts)
		.pluck('tags').flatten()
		.countBy(_.identity)
		.value();

	$scope.uniqueTags = _.chain($scope.countByHashtags)
			.pairs()
			.sortBy(function(p) { return descendingSortKey(p[1], p[0]); })
			.map(function(p) { return p[0]; })
			.value();

	$scope.filteringTags = [];
	$scope.selectedTags = function(post) {
		if($scope.filteringTags.length == 0) { return true; }
		return _.every($scope.filteringTags, function(t) { return _.contains(post.tags, t); }); 
	};
	var oldFP;
	$scope.$watch('posts | filter:selectedTags | filter:search', function (filteredPosts) {
		console.log("watch executed");
		if(!_.isEqual(filteredPosts, oldFP)) {
			console.log("watch: changed countByHashtags");
		    $scope.countByHashtags 	= _.chain(filteredPosts)
				.pluck('tags').flatten()
				.countBy(_.identity)
				.value();
			$scope.uniqueTags = _.chain($scope.countByHashtags)
				.pairs()
				.sortBy(function(p) { return descendingSortKey(p[1], p[0]); })
				.map(function(p) { return p[0]; })
				.value();
		}
	  }, true);
	$scope.count = function(tag) { 
		return $scope.countByHashtags[tag] ? $scope.countByHashtags[tag] : 0; 
	};
	$scope.tagButtonClass = function(tag) {
		if($scope.countByHashtags[tag]) {
			return _.contains($scope.filteringTags, tag) ? "btn-primary" : "btn-default";
		} else {
			return "btn-default disabled";
		}
	};
	
	$scope.toggleTag = function(tag) {
		var index = $scope.filteringTags.indexOf(tag);
		if(index >= 0) {
			console.log("removing tag filter: " + tag);
			$scope.filteringTags.splice(index, 1);
		} else {
			console.log("add tag filter: " + tag);
			$scope.filteringTags.push(tag);
		}
	};
})

