"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Unserializer = void 0;
var buffer_1 = require("buffer");
var Unserializer = (function () {
    function Unserializer(s) {
        this.buf = "";
        this.pos = 0;
        this.length = 0;
        this.cache = [];
        this.scache = [];
        Unserializer.initialize();
        this.buf = s;
        this.length = s.length;
        var r = Unserializer.DEFAULT_RESOLVER;
        if (r === null || r === undefined) {
            r = Unserializer.DefaultResolver;
            Unserializer.DEFAULT_RESOLVER = r;
        }
        this.resolver = r;
    }
    Unserializer.registerSerializableClass = function (clazz) {
        var name = clazz.name;
        if (name === undefined || name === null)
            throw new Error("Unable to get class name");
        if (name === "undefined" || name === "null" || name === "")
            throw new Error("Unable to register that as a serializable class");
        Unserializer.classRegister[name] = clazz;
    };
    Unserializer.initialize = function () {
        if (Unserializer.initialized)
            return;
        Unserializer.initialized = true;
    };
    Unserializer.prototype.isEof = function (c) {
        return c !== c;
    };
    Unserializer.prototype.unserializeObject = function (o) {
        while (true) {
            if (this.pos >= this.length) {
                throw new Error("Invalid object");
            }
            if (this.buf.charCodeAt(this.pos) == 103) {
                break;
            }
            var k = this.unserialize();
            if (typeof (k) != "string") {
                throw new Error("Invalid object key");
            }
            var v = this.unserialize();
            o[k] = v;
        }
        this.pos++;
    };
    Unserializer.prototype.readDigits = function () {
        var k = 0;
        var s = false;
        var fpos = this.pos;
        var get = this.buf.charCodeAt.bind(this.buf);
        while (true) {
            var c = get(this.pos);
            if (this.isEof(c))
                break;
            if (c === 45) {
                if (this.pos != fpos)
                    break;
                s = true;
                this.pos++;
                continue;
            }
            if (c < 48 || c > 57)
                break;
            k = k * 10 + (c - 48);
            this.pos++;
        }
        if (s)
            k *= -1;
        return k;
    };
    Unserializer.prototype.readFloat = function () {
        var p1 = this.pos;
        var get = this.buf.charCodeAt.bind(this.buf);
        while (true) {
            var c = get(this.pos);
            if (this.isEof(c))
                break;
            if ((c >= 43 && c < 58) || c === 101 || c === 69)
                this.pos++;
            else
                break;
        }
        return parseFloat(this.buf.substr(p1, this.pos - p1));
    };
    Unserializer.prototype.unserialize = function () {
        var err = function (s) {
            return new Error("Unserialization of " + s + " not implemented");
        };
        var get = this.buf.charCodeAt.bind(this.buf);
        switch (get(this.pos++)) {
            case 110:
                return null;
            case 116:
                return true;
            case 102:
                return false;
            case 122:
                return 0;
            case 105:
                return this.readDigits();
            case 100:
                return this.readFloat();
            case 121:
                var len = this.readDigits();
                if (get(this.pos++) !== 58 || this.length - this.pos < len)
                    throw new Error("Invalid string length");
                var s = this.buf.substr(this.pos, len);
                this.pos += len;
                s = decodeURIComponent(s);
                this.scache.push(s);
                return s;
            case 107:
                return NaN;
            case 109:
                return Number.NEGATIVE_INFINITY;
            case 112:
                return Number.POSITIVE_INFINITY;
            case 97:
                var a = new Array();
                this.cache.push(a);
                while (true) {
                    var c = get(this.pos);
                    if (c === 104) {
                        this.pos++;
                        break;
                    }
                    if (c === 117) {
                        this.pos++;
                        var n = this.readDigits();
                        a[a.length + n - 1] = null;
                    }
                    else
                        a.push(this.unserialize());
                }
                return a;
            case 111:
                var o = {};
                this.cache.push(o);
                this.unserializeObject(o);
                return o;
            case 114:
                var n = this.readDigits();
                if (n < 0 || n >= this.cache.length)
                    throw err("Invalid reference");
                return this.cache[n];
            case 82:
                var n = this.readDigits();
                if (n < 0 || n >= this.scache.length)
                    throw err("Invalid string reference");
                return this.scache[n];
            case 120:
                throw new Error(this.unserialize());
            case 99:
                var cname = this.unserialize();
                var cli = this.resolver.resolveClass(cname);
                if (!cli)
                    throw err("Class not found " + cname);
                var co = Object.create(cli.prototype);
                this.cache.push(co);
                this.unserializeObject(co);
                return co;
            case 119:
                throw err("enum instance by name");
            case 106:
                throw err("enum instance by index");
            case 108:
                var l = new Array();
                this.cache.push(l);
                while (get(this.pos) !== 104)
                    l.push(this.unserialize());
                this.pos++;
                return l;
            case 98:
                var hsm = {};
                this.cache.push(hsm);
                while (get(this.pos) != 104) {
                    var smt = this.unserialize();
                    hsm[smt] = this.unserialize();
                }
                this.pos++;
                return hsm;
            case 113:
                var him = {};
                this.cache.push(him);
                var c = get(this.pos++);
                while (c === 58) {
                    var i = this.readDigits();
                    him[i] = this.unserialize();
                    c = get(this.pos++);
                }
                if (c !== 104)
                    throw new Error("Invalid IntMap format");
                return him;
            case 77:
                var wm = new WeakMap();
                this.cache.push(wm);
                while (get(this.pos) !== 104) {
                    var wms = this.unserialize();
                    wm.set(wms, this.unserialize());
                }
                this.pos++;
                return wm;
            case 118:
                var d = new Date(this.readFloat());
                this.cache.push(d);
                return d;
            case 115:
                var bytesLen = this.readDigits();
                if (get(this.pos++) !== 58 || this.length - this.pos < bytesLen)
                    throw err("Invalid bytes length");
                var bytes = buffer_1.Buffer.from(this.buf.substr(this.pos, bytesLen), 'base64');
                this.pos += bytesLen;
                this.cache.push(bytes);
                return bytes;
            case 67:
                var name = this.unserialize();
                var cl = this.resolver.resolveClass(name);
                if (cl == null)
                    throw err("Class not found " + name);
                var cclo = Object.create(cl.prototype);
                this.cache.push(cclo);
                cclo._qwkpktDecode(this);
                if (get(this.pos++) !== 103)
                    throw err("Invalid custom data");
                return cclo;
            case 65:
                throw err("classes");
            case 66:
                throw err("enums");
            default:
        }
        this.pos--;
        throw (new Error("Invalid char " + get(this.pos) + " at position " + this.pos));
    };
    Unserializer.classRegister = {};
    Unserializer.initialized = false;
    Unserializer.DefaultResolver = {
        resolveClass: function (name) { return Unserializer.classRegister[name]; }
    };
    Unserializer.DEFAULT_RESOLVER = Unserializer.DefaultResolver;
    return Unserializer;
}());
exports.Unserializer = Unserializer;
//# sourceMappingURL=Unserializer.js.map