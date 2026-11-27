// MagicTouch formulas: a small, safe maths evaluator so activity files can carry their own formulas
// and worked-solution lines as data. No eval(): only numbers, variable names, + − × ÷ ^, brackets
// and the functions listed in FN. Works in the browser (MT.expr) and in Node (for the checker).
//   expr("V / R", {V:12, R:6})                 -> 2
//   fill("I = {V} ÷ {R} = {V/R:2} A", vals)    -> "I = 12 ÷ 6 = 2.00 A"   ({x:2} = 2 decimals)
export const MTExpr = (function () {
  const FN = {
    sqrt: Math.sqrt,
    abs: Math.abs,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
    min: Math.min,
    max: Math.max,
    log: function (x) {
      return Math.log10(x);
    },
    ln: Math.log,
    exp: Math.exp,
    sin: function (d) {
      return Math.sin((d * Math.PI) / 180);
    },
    cos: function (d) {
      return Math.cos((d * Math.PI) / 180);
    },
    tan: function (d) {
      return Math.tan((d * Math.PI) / 180);
    },
  };
  const CONST = { pi: Math.PI, e: Math.E };
  const cache = {};
  function tokens(s) {
    const out = [];
    let i = 0;
    let m;
    s = String(s).replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) {
        i++;
        continue;
      }
      if ((m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i)))) {
        out.push({ t: "n", v: parseFloat(m[0]) });
        i += m[0].length;
        continue;
      }
      if ((m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i)))) {
        out.push({ t: "id", v: m[0] });
        i += m[0].length;
        continue;
      }
      if ("+-*/^(),".indexOf(c) >= 0) {
        out.push({ t: c });
        i++;
        continue;
      }
      throw new Error('cannot read "' + c + '" in formula "' + s + '"');
    }
    return out;
  }
  // grammar: sum := prod (('+'|'-') prod)* ; prod := unary (('*'|'/') unary)* ; unary := '-' unary | pow ; pow := atom ('^' unary)?
  function parse(src) {
    if (cache[src]) return cache[src];
    const tk = tokens(src);
    let p = 0;
    function peek(t) {
      return tk[p] && tk[p].t === t;
    }
    function need(t) {
      if (!peek(t)) throw new Error('expected "' + t + '" in formula "' + src + '"');
      p++;
    }
    function sum() {
      let a = prod();
      while (peek("+") || peek("-")) {
        const op = tk[p++].t,
          b = prod();
        a =
          op === "+"
            ? bin(a, b, function (x, y) {
                return x + y;
              })
            : bin(a, b, function (x, y) {
                return x - y;
              });
      }
      return a;
    }
    function prod() {
      let a = unary();
      while (peek("*") || peek("/")) {
        const op = tk[p++].t,
          b = unary();
        a =
          op === "*"
            ? bin(a, b, function (x, y) {
                return x * y;
              })
            : bin(a, b, function (x, y) {
                return x / y;
              });
      }
      return a;
    }
    function unary() {
      if (peek("-")) {
        p++;
        const a = unary();
        return function (v) {
          return -a(v);
        };
      }
      if (peek("+")) {
        p++;
        return unary();
      }
      return pow();
    }
    function pow() {
      const a = atom();
      if (peek("^")) {
        p++;
        const b = unary();
        return bin(a, b, Math.pow);
      }
      return a;
    }
    function bin(a, b, f) {
      return function (v) {
        return f(a(v), b(v));
      };
    }
    function atom() {
      const t = tk[p];
      if (!t) throw new Error('formula "' + src + '" ends too early');
      if (t.t === "n") {
        p++;
        return function () {
          return t.v;
        };
      }
      if (t.t === "(") {
        p++;
        const a = sum();
        need(")");
        return a;
      }
      if (t.t === "id") {
        p++;
        if (peek("(")) {
          const f = FN[t.v];
          if (!f) throw new Error('unknown function "' + t.v + '" in formula "' + src + '"');
          p++;
          const args = [];
          if (!peek(")")) {
            args.push(sum());
            while (peek(",")) {
              p++;
              args.push(sum());
            }
          }
          need(")");
          return function (v) {
            return f.apply(
              null,
              args.map(function (g) {
                return g(v);
              }),
            );
          };
        }
        const name = t.v;
        return function (v) {
          if (v && Object.prototype.hasOwnProperty.call(v, name)) return +v[name];
          if (name in CONST) return CONST[name];
          throw new Error('unknown name "' + name + '" in formula "' + src + '"');
        };
      }
      throw new Error('unexpected "' + t.t + '" in formula "' + src + '"');
    }
    const f = sum();
    if (p < tk.length) throw new Error('extra "' + tk[p].t + '" in formula "' + src + '"');
    return (cache[src] = f);
  }
  function expr(src, vars) {
    return parse(src)(vars || {});
  }
  // short, readable numbers: whole numbers stay whole, others get up to 3 decimals
  function fmt(x, dp) {
    if (!isFinite(x)) return x > 0 ? "∞" : x < 0 ? "−∞" : "—";
    if (dp !== undefined) return x.toFixed(dp).replace("-", "−");
    const r = Math.round(x * 1000) / 1000;
    return String(r).replace("-", "−");
  }
  function fill(text, vars) {
    return String(text).replace(/\{([^{}]+?)(?::(\d))?\}/g, function (all, e, dp) {
      try {
        return fmt(expr(e, vars), dp === undefined ? undefined : +dp);
      } catch (err) {
        return "{" + e + "}";
      }
    });
  }
  // for the checker: every {…} placeholder in a text, so bad formulas are caught before class
  function placeholders(text) {
    const out = [];
    const re = /\{([^{}]+?)(?::(\d))?\}/g;
    let m;
    while ((m = re.exec(String(text)))) out.push(m[1]);
    return out;
  }
  const api = { expr: expr, parse: parse, fill: fill, fmt: fmt, placeholders: placeholders };
  return api;
})();
