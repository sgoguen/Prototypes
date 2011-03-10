///  <reference path="jquery-1.5.min.js"/>

var root = (function () {

  Functions = {
    Identity: function (x) { return x; },
    True: function () { return true; },
    Blank: function () { }
  }

  //  Taken from http://linqjs.codeplex.com/
  //  created and maintained by neuecc <ils@neue.cc>
  //  licensed under Microsoft Public License(Ms-PL)
  Utils = {
    CreateLambda: function (expression) {
      if (expression == null) return Functions.Identity;
      if (typeof expression == 'string') {
        if (expression == "") {
          return Functions.Identity;
        } else if (expression.indexOf("=>") == -1) {
          return new Function("$,$$,$$$,$$$$", "return " + expression);
        } else {
          var expr = expression.match(/^[(\s]*([^()]*?)[)\s]*=>(.*)/);
          return new Function(expr[1], "return " + expr[2]);
        }
      }
      return expression;
    }
  }

  event = (function (jQuery, window, document, undefined) {

    //  Taken from http://linqjs.codeplex.com/
    //  created and maintained by neuecc <ils@neue.cc>
    //  licensed under Microsoft Public License(Ms-PL)

    var handlerPrototype = {
      isHandler: true
    }

    /*
    handler:  
    (string | T -> U | T -> deferred<U>) -> (T -> deferred<U>)
    */
    function handler(f) {
      f = Utils.CreateLambda(f);
      if (f.isHandler) return f;
      var r = function (args) {
        return $.Deferred(function (d) {
          try {
            d.resolve(f(args));
          } catch (e) {
            d.reject(e);
          }
        });
      }
      $.extend(r, handlerPrototype);
      return r;
    }

    function asynchandler(f) {
      var r = function (args) {
        return $.Deferred(function (d) {
          try {
            f(args, d);
          } catch (e) {
            d.reject(e);
          }
        });
      }
      $.extend(r, handlerPrototype);
      return r;
    }

    function FoldRight(array, combine) {
      var last = array.length - 1;

      if (array.length == 1) return array[0];
      var result = array[last];
      for (var i = last - 1; i >= 0; i--) {
        var current = array[i];
        result = combine(current, result);
      }
      return result;
    }

    function sequencePair(h1, h2) {
      return asynchandler(function (a1, d) {
        h1(a1).done(function (a2) {
          h2(a2).done(d.resolve).fail(d.reject);
        }).fail(d.reject)
      });
    }

    function sequenceMany() {
      var handlers = arguments;
      if (handlers.length < 1) return handler('o=>o');
      handlers = $.map(handlers, handler)
      return FoldRight(handlers, sequencePair);
    }

    handlerPrototype.select = function (expr) {
      var first = this;
      var f = Utils.CreateLambda(expr);
      return sequenceMany(first, handler(f));
    }
    handlerPrototype.then = handlerPrototype.select;
    handlerPrototype.sendTo = handlerPrototype.select;

    handlerPrototype.where = function (expr) {
      var first = this;
      var test = Utils.CreateLambda(expr);
      return asynchandler(function (args, d) {
        first(args).done(function (r) {
          var IsValid = test(r);
          if (IsValid) { d.resolve(r); return; }
          d.cancel();
        });
      })
    }
    handlerPrototype.keeping = handlerPrototype.where;

    handlerPrototype.fail = function (expr) {
      var first = handler(this);
      var f = handler(Utils.CreateLambda(expr));
      return asynchandler(function (a, d) {
        first(a).done(d.resolve).fail(function (e) {
          f(e);
          d.reject(e);
        });
      });
    }

    handlerPrototype.handleFailure = function (expr) {
      var first = handler(this);
      var f = Utils.CreateLambda(expr);
      return asynchandler(function (a, d) {
        first(a).done(d.resolve).fail(function (e) {
          d.resolve(f(e));
        });
      });
    }

    function ifThenElse(source, test, whenTrue, whenFalse) {
      source = handler(source);
      test = Utils.CreateLambda(test);
      whenTrue = handler(whenTrue);
      whenFalse = handler(whenFalse);

      return asynchandler(function (input, promise) {

        source(input).done(function (r) {
          if (test(r)) {
            whenTrue(r).done(promise.resolve).fail(promise.reject);
          } else {
            whenFalse(r).done(promise.resolve).fail(promise.reject);
          }
        }).fail(promise.reject);



      });
    }

    handlerPrototype.If = function (test, whenTrue, whenFalse) {
      var source = this;
      if (typeof whenFalse == 'undefined') whenFalse = 'null';
      return ifThenElse(source, test, whenTrue, whenFalse);
    }

    function whenAll() {
      var handlers = arguments;
      return asynchandler(function (arg, d) {
        var deferreds = $.map(handlers, function (h) { return h(arg); });
        $.when.apply(this, deferreds).then(function () {
          d.resolve(arguments);
        });
      });
    }

    function TryBoth(first, second) {
      first = handler(first);
      second = handler(second);
      return asynchandler(function (args, d) {
        first(args).done(function (r) {
          var IsValid = !(r == undefined || r == null);
          if (IsValid) { d.resolve(r); return; }
          second(args).done(d.resolve);
        });
      })
    }

    function TryEvents() {
      var handlers = arguments;
      if (handlers.length < 1) return handler('o=>o');
      var handlers = $.map(handlers, handler)
      return FoldRight(handlers, TryBoth);
    }

    function createFrom(val) {
      return handler(function () { return val; });
    }

    return {
      handler: handler,
      asynchandler: asynchandler,
      sequence: sequenceMany,
      whenAll: whenAll,
      Try: TryEvents,
      create: handler,
      data: createFrom
    };

  })(jQuery, window, document);

  tube = {
    fromFunction: event.handler,
    fromAsyncFunction: event.asynchandler,
    sequence: event.sequence,
    whenAll: event.sequence,
    source: event.create
  }

  return {
    tube: tube,
    Functions: Functions,
    Utils: Utils
  }

})();