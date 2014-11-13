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
	function pluckTop(bag, count) {
		var _ = window._;
		return _.chain(bag).pairs().sortBy(function(p) { return -p[1]; }).first(count).value();
	}
	
	InstagramTags.summarizeTag('stelladot', null, 30).then(
		function success(results) {
			$scope.results = {
					byUsers: pluckTop(results.byUsers, 10), 
					byHashtags: pluckTop(results.byHashtags, 10), 
					hashtagsByUser: pluckTop(results.hashtagsByUser, 10)
			};
			console.dir($scope.results);
		});
});