'use strict';

angular.module('myApp.view1', ['ngRoute', 'services', 'ui.bootstrap'])

.config(function($routeProvider) {
  $routeProvider.when('/view1', {
    templateUrl: 'view1/view1.html',
    controller: 'View1Ctrl'
  });
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


.controller('View1Ctrl', function($scope, _, $modal, InstagramTags) {
	console.log("about to invoke summarizer");
	$scope.tags = "";
	$scope.maxPosts = 200;
	$scope.untilDate = new Date().toISOString().slice(0,10);
	$scope.pluck = 100;
	var summary = InstagramTags.create();
	var tagExpr;
	
	$scope.run = function() {
		$scope.results = null;
		
		if(_.isEmpty($scope.tags)) {
			return $scope.tagsErrorMessage = "Missing tags";
		}
		if($scope.originalTags != $scope.tags) {
			$scope.originalTags = $scope.tags;
			try {					
				$scope.tagsErrorMessage = null;
				tagExpr = tagexprparser.parse($scope.tags);
				var tags = _.uniq(tagExpr.tags());
				if(_.isEmpty(tags)) {
					return $scope.tagsErrorMessage = "Must have at least one positive tag";
				}
				summary.tags = tags;
			} catch(e) {
				return $scope.tagsErrorMessage = e.toString();
			}
		}
		summary.minFollowers = $scope.minFollowers;
		summary.maxPosts = $scope.maxPosts;
		summary.untilDate = $scope.untilDate ? new Date($scope.untilDate) : undefined;
	
		$scope.progress = 0;
		$scope.running = true;
		return summary.update(function(value) { $scope.progress = Math.floor(value); },
				function(post) { return tagExpr.matches(post); })
		.then(function success(results) {
			console.log("update(): setting $scope.results");
			$scope.results = results;
		}, function error(err) {
			alert("An error occurred: " + JSON.stringify(err));
		}).finally(function() {
			$scope.running = false;
		});
	}

	function showPosts(title, posts, user) {
		console.log("show posts: " + title);
		var newScope = $scope.$new();
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
	
	$scope.showPostsFromUser = function(handle) {
		return summary.lookupUserHandle(handle)
		.then(function(user) {
			showPosts("Posts from " + handle,
					_.filter($scope.results.media, function(m) { return m.user.username == handle; }),
					user);
		});
	};
	$scope.showPostsWithTag = function(tag) {
		return showPosts('Posts with  #' + tag,
			_.filter($scope.results.media, function(m) { return _.contains(m.tags, tag); }));
	};
	$scope.showPostsFromUserWithTag = function(handle, tag) {
		return summary.lookupUserHandle(handle)
		.then(function(user) {			
			showPosts('From ' + handle + " with #" + tag, 
					_.filter($scope.results.media,
							function(m) { return m.user.username == handle
						&& _.contains(m.tags, tag); }),
					user);
		});
	};
});