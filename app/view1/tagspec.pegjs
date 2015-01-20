/**
 * A simple PEG.js grammar for expressing tag combinations.
 *   foo					just foo
 *   foo bar				tags contain foo and bar
 *   foo &bar				tags contain foo and bar
 *   foo| bar				tags contain foo or bar
 *   (foo|bar)baz			tags contain (foo or bar) and baz
 */ 
{
  function Tag(t) { this.tag = t; return this; }
  Tag.prototype.matches = function(post) { return _.contains(post.tags, this.tag); };
  Tag.prototype.tags = function() { return [this.tag]; };
  Tag.prototype.toString = function() { return '#' + this.tag; };

  function AntiTag(t) { this.antitag = t; return this; }
  AntiTag.prototype.matches = function(post) { return !_.contains(post.tags, this.antitag); };
  AntiTag.prototype.tags = function() { return []; };
  AntiTag.prototype.toString = function() { return '!' + this.antitag; };

  function TagOrExpr(l,r) { this.op = 'or'; this.left = l; this.right = r; return this; }
  TagOrExpr.prototype.matches = function(post) { return this.left.matches(post) || this.right.matches(post); };
  TagOrExpr.prototype.tags = function() { return this.left.tags().concat(this.right.tags()); };
  TagOrExpr.prototype.toString = function() { return '(' + this.left.toString() + "|" + this.right.toString() + ")"; };

  function TagAndExpr(l,r) { this.op = 'and'; this.left = l; this.right = r; return this; }
  TagAndExpr.prototype.matches = function(post) { return this.left.matches(post) && this.right.matches(post); };
  TagAndExpr.prototype.tags = function() { return this.left.tags().concat(this.right.tags()); };
  TagAndExpr.prototype.toString = function() { return '(' + this.left.toString() + "&" + this.right.toString() + ")"; };
}

start
  = orexpr
	
orexpr
  = left:andexpr _ '|' _ right:orexpr { return new TagOrExpr(left, right); }
  / andexpr
	
andexpr
  = left:primary _ '&' _ right:andexpr { return new TagAndExpr(left, right); }
  / left:primary _ right:andexpr { return new TagAndExpr(left, right); }
  / primary
	
primary
  = tag
  / '(' _ inner:orexpr _ ')' { return inner; }
	
tag "tag"
  = first:[a-zA-Z_] rest:[a-zA-Z0-9_]* { return new Tag(first + rest.join("")); }
  / '!'  first:[a-zA-Z_] rest:[a-zA-Z0-9_]* { return new AntiTag(first + rest.join("")); }

// optional whitespace
_  = [ \t\r\n]*

// mandatory whitespace
__ = [ \t\r\n]+