/**
 * @license almond 0.2.9 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */

/*
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2013-2014 Jiri Vrany, Jiri Hnidek
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

//     Int64.js
//
//     Copyright (c) 2012 Robert Kieffer
//     MIT License - http://opensource.org/licenses/mit-license.php

(function() {
    var requirejs, require, define;
    (function(undef) {
        var main, req, makeMap, handlers, defined = {}, waiting = {}, config = {}, defining = {}, hasOwn = Object.prototype.hasOwnProperty, aps = [].slice, jsSuffixRegExp = /\.js$/;
        function hasProp(obj, prop) {
            return hasOwn.call(obj, prop);
        }
        function normalize(name, baseName) {
            var nameParts, nameSegment, mapValue, foundMap, lastIndex, foundI, foundStarMap, starI, i, j, part, baseParts = baseName && baseName.split("/"), map = config.map, starMap = map && map["*"] || {};
            if (name && name.charAt(0) === ".") if (baseName) {
                baseParts = baseParts.slice(0, baseParts.length - 1), name = name.split("/"), lastIndex = name.length - 1, config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex]) && (name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, "")), name = baseParts.concat(name);
                for (i = 0; i < name.length; i += 1) {
                    
part = name[i];
                    if (part === ".") name.splice(i, 1), i -= 1; else if (part === "..") {
                        if (i === 1 && (name[2] === ".." || name[0] === "..")) break;
                        i > 0 && (name.splice(i - 1, 2), i -= 2);
                    }
                }
                name = name.join("/");
            } else name.indexOf("./") === 0 && (name = name.substring(2));
            if ((baseParts || starMap) && map) {
                nameParts = name.split("/");
                for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join("/");
                    if (baseParts) for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join("/")];
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                foundMap = mapValue, foundI = i;
                                
break;
                            }
                        }
                    }
                    if (foundMap) break;
                    !foundStarMap && starMap && starMap[nameSegment] && (foundStarMap = starMap[nameSegment], starI = i);
                }
                !foundMap && foundStarMap && (foundMap = foundStarMap, foundI = starI), foundMap && (nameParts.splice(0, foundI, foundMap), name = nameParts.join("/"));
            }
            return name;
        }
        function makeRequire(relName, forceSync) {
            return function() {
                return req.apply(undef, aps.call(arguments, 0).concat([ relName, forceSync ]));
            };
        }
        function makeNormalize(relName) {
            return function(name) {
                return normalize(name, relName);
            };
        }
        function makeLoad(depName) {
            return function(value) {
                defined[depName] = value;
            };
        }
        function callDep
(name) {
            if (hasProp(waiting, name)) {
                var args = waiting[name];
                delete waiting[name], defining[name] = !0, main.apply(undef, args);
            }
            if (!hasProp(defined, name) && !hasProp(defining, name)) throw new Error("No " + name);
            return defined[name];
        }
        function splitPrefix(name) {
            var prefix, index = name ? name.indexOf("!") : -1;
            return index > -1 && (prefix = name.substring(0, index), name = name.substring(index + 1, name.length)), [ prefix, name ];
        }
        makeMap = function(name, relName) {
            var plugin, parts = splitPrefix(name), prefix = parts[0];
            return name = parts[1], prefix && (prefix = normalize(prefix, relName), plugin = callDep(prefix)), prefix ? plugin && plugin.normalize ? name = plugin.normalize(name, makeNormalize(relName)) : name = normalize(name, relName) : (name = normalize(name, relName), parts = splitPrefix(name), prefix = 
parts[0], name = parts[1], prefix && (plugin = callDep(prefix))), {
                f: prefix ? prefix + "!" + name : name,
                n: name,
                pr: prefix,
                p: plugin
            };
        };
        function makeConfig(name) {
            return function() {
                return config && config.config && config.config[name] || {};
            };
        }
        handlers = {
            require: function(name) {
                return makeRequire(name);
            },
            exports: function(name) {
                var e = defined[name];
                return typeof e != "undefined" ? e : defined[name] = {};
            },
            module: function(name) {
                return {
                    id: name,
                    uri: "",
                    exports: defined[name],
                    config: makeConfig(name)
                };
            }
        }, main = function(name, deps, callback, relName) {
            var cjsModule
, depName, ret, map, i, args = [], callbackType = typeof callback, usingExports;
            relName = relName || name;
            if (callbackType === "undefined" || callbackType === "function") {
                deps = !deps.length && callback.length ? [ "require", "exports", "module" ] : deps;
                for (i = 0; i < deps.length; i += 1) {
                    map = makeMap(deps[i], relName), depName = map.f;
                    if (depName === "require") args[i] = handlers.require(name); else if (depName === "exports") args[i] = handlers.exports(name), usingExports = !0; else if (depName === "module") cjsModule = args[i] = handlers.module(name); else if (hasProp(defined, depName) || hasProp(waiting, depName) || hasProp(defining, depName)) args[i] = callDep(depName); else {
                        if (!map.p) throw new Error(name + " missing " + depName);
                        map.p.load(map.n, makeRequire(relName, !0), makeLoad(depName), {}), args[i] = defined[depName];
                    
}
                }
                ret = callback ? callback.apply(defined[name], args) : undefined;
                if (name) if (cjsModule && cjsModule.exports !== undef && cjsModule.exports !== defined[name]) defined[name] = cjsModule.exports; else if (ret !== undef || !usingExports) defined[name] = ret;
            } else name && (defined[name] = callback);
        }, requirejs = require = req = function(deps, callback, relName, forceSync, alt) {
            if (typeof deps == "string") return handlers[deps] ? handlers[deps](callback) : callDep(makeMap(deps, callback).f);
            if (!deps.splice) {
                config = deps, config.deps && req(config.deps, config.callback);
                if (!callback) return;
                callback.splice ? (deps = callback, callback = relName, relName = null) : deps = undef;
            }
            return callback = callback || function() {}, typeof relName == "function" && (relName = forceSync, forceSync = alt), forceSync ? main(undef
, deps, callback, relName) : setTimeout(function() {
                main(undef, deps, callback, relName);
            }, 4), req;
        }, req.config = function(cfg) {
            return req(cfg);
        }, requirejs._defined = defined, define = function(name, deps, callback) {
            deps.splice || (callback = deps, deps = []), !hasProp(defined, name) && !hasProp(waiting, name) && (waiting[name] = [ name, deps, callback ]);
        }, define.amd = {
            jQuery: !0
        };
    })(), define("../bower_components/almond/almond", function() {}), define("request", [], function() {
        var request = {
            message: function message(payload) {
                var messageLen, buf, view, payloadView;
                messageLen = 4 + payload.byteLength, buf = new ArrayBuffer(messageLen), view = new DataView(buf), payloadView = new DataView(payload), view.setUint8(0, 16), view.setUint16(2, messageLen);
                for (var i = 0; i < payload.byteLength; i++) view
.setUint8(i + 4, payloadView.getUint8(i));
                return buf;
            },
            buffer_push: function buffer_push(bufferA, bufferB) {
                var result, viewResult, viewA, viewB, i, j, messageLen;
                messageLen = bufferA.byteLength + bufferB.byteLength, result = new ArrayBuffer(messageLen), viewResult = new DataView(result), viewA = new DataView(bufferA), viewB = new DataView(bufferB);
                for (i = 0; i < bufferA.byteLength; i++) viewResult.setUint8(i, viewA.getUint8(i));
                for (j = bufferA.byteLength; j < messageLen; j++) viewResult.setUint8(j, viewB.getUint8(j - bufferA.byteLength));
                return result;
            }
        };
        return request;
    }), define("negotiation", [], function() {
        var negotiation, sendStringMessage, sendIntMessage;
        sendStringMessage = function(messageType, payload, featureType) {
            var buf, view, messageLen, i;
            messageLen = 4 + payload.length
, buf = new ArrayBuffer(messageLen), view = new DataView(buf), view.setUint8(0, messageType), view.setUint8(1, messageLen), view.setUint8(2, featureType), view.setUint8(3, payload.length);
            for (i = 0; i < payload.length; i++) view.setUint8(4 + i, payload.charCodeAt(i));
            return buf;
        }, sendIntMessage = function(messageType, payload, featureType) {
            var buf, view;
            return buf = new ArrayBuffer(4), view = new DataView(buf), view.setUint8(0, messageType), view.setUint8(1, 4), view.setUint8(2, featureType), view.setUint8(3, payload), buf;
        };
        var parseFeature = function parseFeature(feature, receivedView, bufferPosition, length) {
            var value, stringFeatures = {
                3: "HOST_URL",
                4: "TOKEN",
                5: "DED",
                9: "CLIENT_NAME",
                10: "CLIENT_VERSION"
            }, intFeatures = {
                1: "FCID",
                2: "CCID",
                6
: "RWIN",
                8: "COMMAND_COMPRESSION"
            };
            return feature in stringFeatures ? (value = parseStringValue(receivedView, length, bufferPosition), {
                FEATURE: stringFeatures[feature],
                VALUE: value
            }) : feature in intFeatures ? {
                FEATURE: intFeatures[feature],
                VALUE: receivedView.getUint8(7)
            } : {
                FEATURE: feature,
                VALUE: "TBD"
            };
        }, parseStringValue = function parseStringValue(receivedDataView, length, bufferPosition) {
            var i, result = "";
            for (i = 0; i <= length - 4; i++) result += String.fromCharCode(receivedDataView.getUint8(bufferPosition + 2 + i));
            return result.slice(1);
        };
        return negotiation = {
            CHANGE_L: 3,
            CHANGE_R: 4,
            CONFIRM_L: 5,
            CONFIRM_R: 6,
            getFeatureValues: function getFeatureValues(feature, receivedView
, bufferPosition, length) {
                return parseFeature(feature, receivedView, bufferPosition, length);
            },
            fcid: function(type, id) {
                return sendIntMessage(type, id, 1);
            },
            ccid: function(type, id) {
                return sendIntMessage(type, id, 2);
            },
            url: function(type, nurl) {
                return sendStringMessage(type, nurl, 3);
            },
            token: function(type, tokenString) {
                return sendStringMessage(type, tokenString, 4);
            },
            ded: function(type, dedString) {
                return sendStringMessage(type, dedString, 5);
            },
            rwin: function(type, value) {
                return sendIntMessage(type, value, 6);
            },
            fps: function(messageType, value) {
                var buf, view;
                return buf = new ArrayBuffer(7), view = new DataView(buf), view.setUint8(0, messageType), view
.setUint8(1, 7), view.setUint8(2, 7), view.setFloat32(3, value), buf;
            },
            compression: function(type, value) {
                return sendIntMessage(type, value, 8);
            }
        }, negotiation;
    }), define("message", [], function() {
        var message;
        return message = {
            template: function(length, opCode) {
                var buf, view;
                return buf = new ArrayBuffer(length), view = new DataView(buf), view.setUint8(0, opCode), view.setUint8(1, length), buf;
            }
        }, message;
    }), define("node", [ "message" ], function(message) {
        var node, commands, routines;
        return commands = {
            32: "NODE_CREATE",
            33: "NODE_DESTROY",
            34: "NODE_SUBSCRIBE",
            35: "NODE_UNSUBSCRIBE",
            37: "NODE_LINK",
            38: "NODE_PERMISIONS",
            39: "NODE_UMASK",
            40: "NODE_OWNER",
            41: "NODE_LOCK",
            42: "NODE_UNLOCK"
,
            43: "NODE_PRIORITY"
        }, routines = {
            32: function getNodeCreate(opCode, receivedView, bufferPosition) {
                return {
                    CMD: commands[opCode],
                    SHARE: receivedView.getUint8(bufferPosition + 2),
                    USER_ID: receivedView.getUint16(bufferPosition + 3),
                    PARENT_ID: receivedView.getUint32(bufferPosition + 5),
                    NODE_ID: receivedView.getUint32(bufferPosition + 9),
                    CUSTOM_TYPE: receivedView.getUint16(bufferPosition + 13)
                };
            },
            33: function getNodeDestroy(opCode, receivedView, bufferPosition) {
                return {
                    CMD: commands[opCode],
                    NODE_ID: receivedView.getUint32(bufferPosition + 3)
                };
            },
            34: function getNodeSubscribe(opCode, receivedView, bufferPosition) {
                return {
                    CMD: commands
[opCode],
                    NODE_ID: receivedView.getUint32(bufferPosition + 2),
                    VERSION: receivedView.getUint32(bufferPosition + 6),
                    CRC32: receivedView.getUint32(bufferPosition + 10)
                };
            },
            35: function getNodeUnsubscribe(opCode, receivedView, bufferPosition) {
                return {
                    CMD: commands[opCode],
                    NODE_ID: receivedView.getUint32(bufferPosition + 2),
                    VERSION: receivedView.getUint32(bufferPosition + 6),
                    CRC32: receivedView.getUint32(bufferPosition + 10)
                };
            },
            37: function getNodeLink(opCode, receivedView, bufferPosition) {
                return {
                    CMD: commands[opCode],
                    SHARE: receivedView.getUint8(bufferPosition + 2),
                    PARENT_ID: receivedView.getUint32(bufferPosition + 3),
                    CHILD_ID: receivedView.getUint32
(bufferPosition + 7)
                };
            },
            38: function getNodePermissions(opCode, receivedView, bufferPosition) {
                return {
                    CMD: commands[opCode],
                    SHARE: receivedView.getUint8(bufferPosition + 2),
                    USER_ID: receivedView.getUint16(bufferPosition + 3),
                    PERMISSIONS: receivedView.getUint8(bufferPosition + 5),
                    NODE_ID: receivedView.getUint32(bufferPosition + 6)
                };
            },
            39: function getNodeUmask(opCode, receivedView, bufferPosition) {
                return {
                    CMD: commands[opCode],
                    PERMISSIONS: receivedView.getUint8(bufferPosition + 2)
                };
            },
            40: function getNodeOwner(opCode, receivedView, bufferPosition) {
                return {
                    CMD: commands[opCode],
                    SHARE: receivedView.getUint8(bufferPosition + 2)
,
                    USER_ID: receivedView.getUint16(bufferPosition + 3),
                    NODE_ID: receivedView.getUint32(bufferPosition + 5)
                };
            },
            41: function getNodeLock(opCode, receivedView, bufferPosition) {
                return {
                    CMD: commands[opCode],
                    SHARE: receivedView.getUint8(bufferPosition + 2),
                    AVATAR_ID: receivedView.getUint32(bufferPosition + 3),
                    NODE_ID: receivedView.getUint32(bufferPosition + 7)
                };
            },
            42: function getNodeUnlock(opCode, receivedView, bufferPosition) {
                return {
                    CMD: commands[opCode],
                    SHARE: receivedView.getUint8(bufferPosition + 2),
                    AVATAR_ID: receivedView.getUint32(bufferPosition + 3),
                    NODE_ID: receivedView.getUint32(bufferPosition + 7)
                };
            }
        }, node = {
            
subscribe: function(id) {
                var msg, view;
                return msg = message.template(14, 34), view = new DataView(msg), view.setUint32(2, id), view.setUint32(6, 0), view.setUint32(10, 0), msg;
            },
            getNodeValues: function getNodeValues(opCode, receivedView, bufferPosition, length) {
                var result = routines[opCode](opCode, receivedView, bufferPosition, length);
                return result;
            }
        }, node;
    }), define("taggroup", [ "message" ], function(message) {
        var commands, routines, tagGroup, sendSubUnsub, getSubUnsub;
        return sendSubUnsub = function sendSubUnsub(opCode, nodeId, tagGroupId) {
            var msg, view;
            return msg = message.template(17, opCode), view = new DataView(msg), view.setUint8(3, 0), view.setUint32(3, nodeId), view.setUint16(7, tagGroupId), view.setUint32(9, 0), view.setUint32(13, 0), msg;
        }, getSubUnsub = function getSubUnsub(opCode, receivedView, bufferPosition
) {
            return {
                CMD: commands[opCode],
                SHARE: receivedView.getUint8(bufferPosition + 2),
                NODE_ID: receivedView.getUint32(bufferPosition + 3),
                TAG_GROUP_ID: receivedView.getUint16(bufferPosition + 7),
                VERSION: receivedView.getUint32(bufferPosition + 9),
                CRC32: receivedView.getUint32(bufferPosition + 13)
            };
        }, commands = {
            64: "TAG_GROUP_CREATE",
            65: "TAG_GROUP_DESTROY",
            66: "TAG_GROUP_SUBSCRIBE",
            67: "TAG_GROUP_UNSUBSCRIBE"
        }, routines = {
            64: function getTagGroupCreate(opCode, receivedView, bufferPosition) {
                return {
                    CMD: commands[opCode],
                    SHARE: receivedView.getUint8(bufferPosition + 2),
                    NODE_ID: receivedView.getUint32(bufferPosition + 3),
                    TAG_GROUP_ID: receivedView.getUint16(bufferPosition + 7),
                    
CUSTOM_TYPE: receivedView.getUint16(bufferPosition + 9)
                };
            },
            65: function getTagGroupDestroy(opCode, receivedView, bufferPosition) {
                return {
                    CMD: commands[opCode],
                    SHARE: receivedView.getUint8(bufferPosition + 2),
                    NODE_ID: receivedView.getUint32(bufferPosition + 3),
                    TAG_GROUP_ID: receivedView.getUint16(bufferPosition + 7)
                };
            },
            66: getSubUnsub,
            67: getSubUnsub
        }, tagGroup = {
            subscribe: function(nodeId, tagGroupId) {
                return sendSubUnsub(66, nodeId, tagGroupId);
            },
            unsubscribe: function(nodeId, tagGroupId) {
                return sendSubUnsub(67, nodeId, tagGroupId);
            },
            getTagGroupValues: function getTagGroupValues(opCode, receivedView, bufferPosition, length) {
                var result = routines[opCode](opCode, receivedView
, bufferPosition, length);
                return result;
            }
        }, tagGroup;
    }), define("Int64", [], function() {
        var Int64 = function(a1, offset) {
            offset = offset || 0, a1 instanceof Array ? this.storage = a1.slice(offset, 8) : (this.storage = this.storage || new Array(8), this.setValue.apply(this, arguments));
        };
        Int64.MAX_INT = Math.pow(2, 53), Int64.MIN_INT = -Math.pow(2, 53), Int64.HexTable = new Array(256);
        for (var i = 0; i < 256; i++) Int64.HexTable[i] = (i > 15 ? "" : "0") + i.toString(16);
        return Int64.prototype = {
            _2scomp: function() {
                var b = this.storage, o = o, carry = 1;
                for (var i = o + 7; i >= o; i--) {
                    var v = (b[i] ^ 255) + carry;
                    b[i] = v & 255, carry = v >> 8;
                }
            },
            setValue: function(hi, lo) {
                var negate = !1;
                if (arguments.length === 1) if (typeof 
hi == "number") {
                    negate = hi < 0, hi = Math.abs(hi), lo = hi % 2147483648, hi /= 2147483648;
                    if (hi > 2147483648) throw new RangeError(hi + " is outside Int64 range");
                    hi |= 0;
                } else {
                    if (typeof hi != "string") throw new Error(hi + " must be a Number or String");
                    hi = (hi + "").replace(/^0x/, ""), lo = hi.substr(-8), hi = hi.length > 8 ? hi.substr(0, hi.length - 8) : "", hi = parseInt(hi, 16), lo = parseInt(lo, 16);
                }
                var b = this.storage, o = 0;
                for (var i = 7; i >= 0; i--) b[o + i] = lo & 255, lo = i === 4 ? hi : lo >>> 8;
                negate && this._2scomp();
            },
            toNumber: function(allowImprecise) {
                var b = this.storage, o = 0, negate = b[0] & 128, x = 0, carry = 1;
                for (var i = 7, m = 1; i >= 0; i--, m *= 256) {
                    var v = b[o + i];
                    
negate && (v = (v ^ 255) + carry, carry = v >> 8, v &= 255), x += v * m;
                }
                return !allowImprecise && x >= Int64.MAX_INT ? negate ? -Infinity : Infinity : negate ? -x : x;
            },
            valueOf: function() {
                return this.toNumber(!1);
            },
            toString: function(radix) {
                return this.valueOf().toString(radix || 10);
            },
            toOctetString: function(sep) {
                var out = new Array(8), b = this.storage, o = 0;
                for (var i = 0; i < 8; i++) out[i] = Int64.HexTable[b[o + i]];
                return out.join(sep || "");
            }
        }, Int64;
    }), define("tag", [ "Int64" ], function(Int64) {
        var commands, routines, tag, getTagSetCommons, getTagSetUint8, getTagSetUint16, getTagSetUint32, getTagSetUint64, getTagSetFloat16, getTagSetFloat32, getTagSetFloat64, getTagSetString8;
        return getTagSetCommons = function getTagSetCommons(opCode
, receivedView, bufferPosition) {
            return {
                CMD: commands[opCode],
                SHARE: receivedView.getUint8(bufferPosition + 2),
                NODE_ID: receivedView.getUint32(bufferPosition + 3),
                TAG_GROUP_ID: receivedView.getUint16(bufferPosition + 7),
                TAG_ID: receivedView.getUint16(bufferPosition + 9),
                VALUES: []
            };
        }, getTagSetUint8 = function getTagSetUint8(opCode, receivedView, bufferPosition) {
            var result = getTagSetCommons(opCode, receivedView, bufferPosition);
            return result.VALUES[0] = receivedView.getUint8(bufferPosition + 11), opCode > 70 && (result.VALUES[1] = receivedView.getUint8(bufferPosition + 12)), opCode > 71 && (result.VALUES[2] = receivedView.getUint8(bufferPosition + 13)), opCode > 72 && (result.VALUES[3] = receivedView.getUint8(bufferPosition + 14)), result;
        }, getTagSetUint16 = function getTagSetUint16(opCode, receivedView, bufferPosition
) {
            var result = getTagSetCommons(opCode, receivedView, bufferPosition);
            return result.VALUES[0] = receivedView.getUint16(bufferPosition + 11), opCode > 74 && (result.VALUES[1] = receivedView.getUint16(bufferPosition + 13)), opCode > 75 && (result.VALUES[2] = receivedView.getUint16(bufferPosition + 15)), opCode > 76 && (result.VALUES[3] = receivedView.getUint16(bufferPosition + 17)), result;
        }, getTagSetUint32 = function getTagSetUint32(opCode, receivedView, bufferPosition) {
            var result = getTagSetCommons(opCode, receivedView, bufferPosition);
            return result.VALUES[0] = receivedView.getUint32(bufferPosition + 11), opCode > 78 && (result.VALUES[1] = receivedView.getUint32(bufferPosition + 15)), opCode > 79 && (result.VALUES[2] = receivedView.getUint32(bufferPosition + 19)), opCode > 80 && (result.VALUES[3] = receivedView.getUint32(bufferPosition + 23)), result;
        }, getTagSetUint64 = function getTagSetUint64(opCode, receivedView
, bufferPosition) {
            var result, hi, lo, bigNumber;
            return result = getTagSetCommons(opCode, receivedView, bufferPosition), lo = receivedView.getUint32(bufferPosition + 11), hi = receivedView.getUint32(bufferPosition + 15), bigNumber = new Int64(hi, lo), result.VALUES[0] = bigNumber.valueOf(), opCode > 82 && (lo = receivedView.getUint32(bufferPosition + 19), hi = receivedView.getUint32(bufferPosition + 23), bigNumber = new Int64(hi, lo), result.VALUES[1] = bigNumber.valueOf()), opCode > 83 && (lo = receivedView.getUint32(bufferPosition + 27), hi = receivedView.getUint32(bufferPosition + 31), bigNumber = new Int64(hi, lo), result.VALUES[2] = bigNumber.valueOf()), opCode > 84 && (lo = receivedView.getUint32(bufferPosition + 35), hi = receivedView.getUint32(bufferPosition + 39), bigNumber = new Int64(hi, lo), result.VALUES[3] = bigNumber.valueOf()), result;
        }, getTagSetFloat16 = function getTagSetFloat16(opCode, receivedView, bufferPosition) {
            var result = 
getTagSetCommons(opCode, receivedView, bufferPosition);
            return result.VALUES[0] = "@TODO > Float16 not supported", result;
        }, getTagSetFloat32 = function getTagSetFloat32(opCode, receivedView, bufferPosition) {
            var result = getTagSetCommons(opCode, receivedView, bufferPosition);
            return result.VALUES[0] = receivedView.getFloat32(bufferPosition + 11), opCode > 90 && (result.VALUES[1] = receivedView.getFloat32(bufferPosition + 15)), opCode > 91 && (result.VALUES[2] = receivedView.getFloat32(bufferPosition + 19)), opCode > 92 && (result.VALUES[3] = receivedView.getFloat32(bufferPosition + 23)), result;
        }, getTagSetFloat64 = function getTagSetFloat64(opCode, receivedView, bufferPosition) {
            var result = getTagSetCommons(opCode, receivedView, bufferPosition);
            return result.VALUES[0] = receivedView.getFloat64(bufferPosition + 11), opCode > 94 && (result.VALUES[1] = receivedView.getFloat64(bufferPosition + 19)), opCode > 95 && 
(result.VALUES[2] = receivedView.getFloat64(bufferPosition + 27)), opCode > 96 && (result.VALUES[3] = receivedView.getFloat64(bufferPosition + 35)), result;
        }, getTagSetString8 = function getTagSetString8(opCode, receivedView, bufferPosition) {
            var i, strLength, result;
            result = getTagSetCommons(opCode, receivedView, bufferPosition), delete result.VALUES, result.VALUE = "", strLength = receivedView.getUint8(11);
            for (i = 0; i < strLength; i++) result.VALUE += String.fromCharCode(receivedView.getUint8(bufferPosition + 12 + i));
            return result;
        }, commands = {
            68: "TAG_CREATE",
            69: "TAG_DESTROY",
            70: "TAG_SET_UINT8",
            71: "TAG_SET_UINT8",
            72: "TAG_SET_UINT8",
            73: "TAG_SET_UINT8",
            74: "TAG_SET_UINT16",
            75: "TAG_SET_UINT16",
            76: "TAG_SET_UINT16",
            77: "TAG_SET_UINT16",
            78: "TAG_SET_UINT32",
            79
: "TAG_SET_UINT32",
            80: "TAG_SET_UINT32",
            81: "TAG_SET_UINT32",
            82: "TAG_SET_UINT64",
            83: "TAG_SET_UINT64",
            84: "TAG_SET_UINT64",
            85: "TAG_SET_UINT64",
            86: "TAG_SET_REAL16",
            87: "TAG_SET_REAL16",
            88: "TAG_SET_REAL16",
            89: "TAG_SET_REAL16",
            90: "TAG_SET_REAL32",
            91: "TAG_SET_REAL32",
            92: "TAG_SET_REAL32",
            93: "TAG_SET_REAL32",
            94: "TAG_SET_REAL64",
            95: "TAG_SET_REAL64",
            96: "TAG_SET_REAL64",
            97: "TAG_SET_REAL64",
            98: "TAG_SET_STRING8"
        }, routines = {
            68: function getTagCreate(opCode, receivedView, bufferPosition) {
                var result;
                return result = getTagSetCommons(opCode, receivedView, bufferPosition), delete result.VALUES, result.DATA_TYPE = receivedView.getUint8(bufferPosition + 11), result.COUNT = receivedView.getUint8
(bufferPosition + 12), result.CUSTOM_TYPE = receivedView.getUint16(bufferPosition + 13), result;
            },
            69: function getTagDestroy(opCode, receivedView, bufferPosition) {
                var result;
                return result = getTagSetCommons(opCode, receivedView, bufferPosition), delete result.VALUES, result;
            },
            70: getTagSetUint8,
            71: getTagSetUint8,
            72: getTagSetUint8,
            73: getTagSetUint8,
            74: getTagSetUint16,
            75: getTagSetUint16,
            76: getTagSetUint16,
            77: getTagSetUint16,
            78: getTagSetUint32,
            79: getTagSetUint32,
            80: getTagSetUint32,
            81: getTagSetUint32,
            82: getTagSetUint64,
            83: getTagSetUint64,
            84: getTagSetUint64,
            85: getTagSetUint64,
            86: getTagSetFloat16,
            87: getTagSetFloat16,
            88: getTagSetFloat16,
            89: getTagSetFloat16
,
            90: getTagSetFloat32,
            91: getTagSetFloat32,
            92: getTagSetFloat32,
            93: getTagSetFloat32,
            94: getTagSetFloat64,
            95: getTagSetFloat64,
            96: getTagSetFloat64,
            97: getTagSetFloat64,
            98: getTagSetString8
        }, tag = {
            getTagValues: function getTagValues(opCode, receivedView, bufferPosition, length) {
                var result = routines[opCode](opCode, receivedView, bufferPosition, length);
                return result;
            }
        }, tag;
    }), define("layer", [ "message", "Int64" ], function(message, Int64) {
        var commands, routines, layer, getLayerCreateCommons, getLayerSetUint8, getLayerSetUint16, getLayerSetUint32, getLayerSetUint64, getLayerSetFloat16, getLayerSetFloat32, getLayerSetFloat64, getLayerCmdCommons, getLayerSubUnsub, sendLayerSubUnsub;
        return getLayerCreateCommons = function getLayerCreateCommons(opCode, receivedView, bufferPosition
) {
            return {
                CMD: commands[opCode],
                SHARE: receivedView.getUint8(bufferPosition + 2),
                NODE_ID: receivedView.getUint32(bufferPosition + 3),
                PARENT_LAYER_ID: receivedView.getUint16(bufferPosition + 7),
                LAYER_ID: receivedView.getUint16(bufferPosition + 9)
            };
        }, getLayerCmdCommons = function getLayerCmdCommons(opCode, receivedView, bufferPosition) {
            return {
                CMD: commands[opCode],
                SHARE: receivedView.getUint8(bufferPosition + 2),
                NODE_ID: receivedView.getUint32(bufferPosition + 3),
                LAYER_ID: receivedView.getUint16(bufferPosition + 7),
                ITEM_ID: receivedView.getUint32(bufferPosition + 9)
            };
        }, getLayerSetUint8 = function getLayerSetUint8(opCode, receivedView, bufferPosition) {
            var result = getLayerCmdCommons(opCode, receivedView, bufferPosition);
            return result
.VALUES = [], result.VALUES[0] = receivedView.getUint8(bufferPosition + 13), opCode > 133 && (result.VALUES[1] = receivedView.getUint8(bufferPosition + 14)), opCode > 134 && (result.VALUES[2] = receivedView.getUint8(bufferPosition + 15)), opCode > 135 && (result.VALUES[3] = receivedView.getUint8(bufferPosition + 16)), result;
        }, getLayerSetUint16 = function getLayerSetUint16(opCode, receivedView, bufferPosition) {
            var result = getLayerCmdCommons(opCode, receivedView, bufferPosition);
            return result.VALUES = [], result.VALUES[0] = receivedView.getUint16(bufferPosition + 13), opCode > 137 && (result.VALUES[1] = receivedView.getUint16(bufferPosition + 15)), opCode > 138 && (result.VALUES[2] = receivedView.getUint16(bufferPosition + 17)), opCode > 139 && (result.VALUES[3] = receivedView.getUint16(bufferPosition + 19)), result;
        }, getLayerSetUint32 = function getLayerSetUint32(opCode, receivedView, bufferPosition) {
            var result = getLayerCmdCommons
(opCode, receivedView, bufferPosition);
            return result.VALUES = [], result.VALUES[0] = receivedView.getUint32(bufferPosition + 13), opCode > 141 && (result.VALUES[1] = receivedView.getUint32(bufferPosition + 17)), opCode > 142 && (result.VALUES[2] = receivedView.getUint32(bufferPosition + 21)), opCode > 143 && (result.VALUES[3] = receivedView.getUint32(bufferPosition + 25)), result;
        }, getLayerSetUint64 = function getLayerSetUint64(opCode, receivedView, bufferPosition) {
            var result, hi, lo, bigNumber;
            return result = getLayerCmdCommons(opCode, receivedView, bufferPosition), result.VALUES = [], lo = receivedView.getUint32(bufferPosition + 13), hi = receivedView.getUint32(bufferPosition + 17), bigNumber = new Int64(hi, lo), result.VALUES[0] = bigNumber.valueOf(), opCode > 145 && (lo = receivedView.getUint32(bufferPosition + 21), hi = receivedView.getUint32(bufferPosition + 25), bigNumber = new Int64(hi, lo), result.VALUES[1] = bigNumber.valueOf()
), opCode > 146 && (lo = receivedView.getUint32(bufferPosition + 29), hi = receivedView.getUint32(bufferPosition + 33), bigNumber = new Int64(hi, lo), result.VALUES[2] = bigNumber.valueOf()), opCode > 147 && (lo = receivedView.getUint32(bufferPosition + 37), hi = receivedView.getUint32(bufferPosition + 41), bigNumber = new Int64(hi, lo), result.VALUES[3] = bigNumber.valueOf()), result;
        }, getLayerSetFloat32 = function getLayerSetFloat32(opCode, receivedView, bufferPosition) {
            var result = getLayerCmdCommons(opCode, receivedView, bufferPosition);
            return result.VALUES = [], result.VALUES[0] = "@TODO - data type Real16 not supported", result;
        }, getLayerSetFloat32 = function getLayerSetFloat32(opCode, receivedView, bufferPosition) {
            var result = getLayerCmdCommons(opCode, receivedView, bufferPosition);
            return result.VALUES = [], result.VALUES[0] = receivedView.getFloat32(bufferPosition + 13), opCode > 153 && (result.VALUES[1] = 
receivedView.getFloat32(bufferPosition + 17)), opCode > 154 && (result.VALUES[2] = receivedView.getFloat32(bufferPosition + 21)), opCode > 155 && (result.VALUES[3] = receivedView.getFloat32(bufferPosition + 25)), result;
        }, getLayerSetFloat64 = function getLayerSetFloat64(opCode, receivedView, bufferPosition) {
            var result = getLayerCmdCommons(opCode, receivedView, bufferPosition);
            return result.VALUES = [], result.VALUES[0] = receivedView.getFloat64(bufferPosition + 13), opCode > 157 && (result.VALUES[1] = receivedView.getFloat64(bufferPosition + 21)), opCode > 158 && (result.VALUES[2] = receivedView.getFloat64(bufferPosition + 29)), opCode > 159 && (result.VALUES[3] = receivedView.getFloat64(bufferPosition + 37)), result;
        }, getLayerSubUnsub = function getLayerSubUnsub(opCode, receivedView, bufferPosition) {
            var result;
            return result = getLayerCmdCommons(opCode, receivedView, bufferPosition), result.VERSION = result.ITEM_ID
, delete result.ITEM_ID, result.CRC32 = receivedView.getUint32(bufferPosition + 13), result;
        }, sendLayerSubUnsub = function sendLayerSubUnsub(opCode, nodeId, layerId) {
            var msg, view;
            return msg = message.template(17, opCode), view = new DataView(msg), view.setUint8(3, 0), view.setUint32(3, nodeId), view.setUint16(7, layerId), view.setUint32(9, 0), view.setUint32(13, 0), msg;
        }, commands = {
            128: "LAYER_CREATE",
            129: "LAYER_DESTROY",
            130: "LAYER_SUBSCRIBE",
            131: "LAYER_UNSUBSCRIBE",
            132: "LAYER_UNSET",
            133: "LAYER_SET_UINT8",
            134: "LAYER_SET_UINT8",
            135: "LAYER_SET_UINT8",
            136: "LAYER_SET_UINT8",
            137: "LAYER_SET_UINT16",
            138: "LAYER_SET_UINT16",
            139: "LAYER_SET_UINT16",
            140: "LAYER_SET_UINT16",
            141: "LAYER_SET_UINT32",
            142: "LAYER_SET_UINT32",
            143: "LAYER_SET_UINT32"
,
            144: "LAYER_SET_UINT32",
            145: "LAYER_SET_UINT64",
            146: "LAYER_SET_UINT64",
            147: "LAYER_SET_UINT64",
            148: "LAYER_SET_UINT64",
            149: "LAYER_SET_REAL16",
            150: "LAYER_SET_REAL16",
            151: "LAYER_SET_REAL16",
            152: "LAYER_SET_REAL16",
            153: "LAYER_SET_REAL32",
            154: "LAYER_SET_REAL32",
            155: "LAYER_SET_REAL32",
            156: "LAYER_SET_REAL32",
            157: "LAYER_SET_REAL64",
            158: "LAYER_SET_REAL64",
            159: "LAYER_SET_REAL64",
            160: "LAYER_SET_REAL64",
            161: "LAYER_UNSET_DATA"
        }, routines = {
            128: function getLayerCreate(opCode, receivedView, bufferPosition) {
                var result;
                return result = getLayerCreateCommons(opCode, receivedView, bufferPosition), result.DATA_TYPE = receivedView.getUint8(bufferPosition + 11), result.COUNT = receivedView.getUint8(bufferPosition + 12
), result.CUSTOM_TYPE = receivedView.getUint16(bufferPosition + 13), result;
            },
            129: function getLayerDestroy(opCode, receivedView, bufferPosition) {
                var result;
                return result = getLayerCreateCommons(opCode, receivedView, bufferPosition), result;
            },
            130: getLayerSubUnsub,
            131: getLayerSubUnsub,
            132: getLayerCmdCommons,
            133: getLayerSetUint8,
            134: getLayerSetUint8,
            135: getLayerSetUint8,
            136: getLayerSetUint8,
            137: getLayerSetUint16,
            138: getLayerSetUint16,
            139: getLayerSetUint16,
            140: getLayerSetUint16,
            141: getLayerSetUint32,
            142: getLayerSetUint32,
            143: getLayerSetUint32,
            144: getLayerSetUint32,
            145: getLayerSetUint64,
            146: getLayerSetUint64,
            147: getLayerSetUint64,
            148: getLayerSetUint64,
            149
: getLayerSetFloat16,
            150: getLayerSetFloat16,
            151: getLayerSetFloat16,
            152: getLayerSetFloat16,
            153: getLayerSetFloat32,
            154: getLayerSetFloat32,
            155: getLayerSetFloat32,
            156: getLayerSetFloat32,
            157: getLayerSetFloat64,
            158: getLayerSetFloat64,
            159: getLayerSetFloat64,
            160: getLayerSetFloat64
        }, layer = {
            subscribe: function(nodeId, layerId) {
                return sendLayerSubUnsub(130, nodeId, layerId);
            },
            unsubscribe: function(nodeId, layerId) {
                return sendLayerSubUnsub(131, nodeId, layerId);
            },
            getLayerValues: function getLayerValues(opCode, receivedView, bufferPosition, length) {
                var result = routines[opCode](opCode, receivedView, bufferPosition, length);
                return result;
            }
        }, layer;
    }), define("response", [ "negotiation"
, "node", "taggroup", "tag", "layer" ], function(negotiation, node, tagGroup, tag, layer) {
        var checkOpCode = function checkOpCode(opCode, receivedView, bufferPosition) {
            var length, feature, cmdValues, opCodes;
            opCodes = {
                3: "CHANGE_L",
                4: "CHANGE_R",
                5: "CONFIRM_L",
                6: "CONFIRM_R",
                7: "USER_AUTH_REQUEST",
                8: "USER_AUTH_FAILURE",
                9: "USER_AUTH_SUCCESS"
            };
            if (opCode !== 8) {
                if (opCode === 9) {
                    var userId = receivedView.getUint16(bufferPosition + 1), avatar = receivedView.getUint32(bufferPosition + 3);
                    return {
                        CMD: "auth_succ",
                        USER_ID: userId,
                        AVATAR_ID: avatar
                    };
                }
                return opCode < 7 ? (length = receivedView.getUint8(bufferPosition), feature = 
receivedView.getUint8(bufferPosition + 1), cmdValues = negotiation.getFeatureValues(feature, receivedView, bufferPosition, length), {
                    CMD: opCodes[opCode],
                    FEATURE: cmdValues.FEATURE,
                    VALUE: cmdValues.VALUE
                }) : opCode > 31 && opCode < 44 ? (length = receivedView.getUint8(bufferPosition), cmdValues = node.getNodeValues(opCode, receivedView, bufferPosition - 1, length), cmdValues) : opCode > 63 && opCode < 68 ? (length = receivedView.getUint8(bufferPosition), cmdValues = tagGroup.getTagGroupValues(opCode, receivedView, bufferPosition - 1, length), cmdValues) : opCode > 67 && opCode < 99 ? (length = receivedView.getUint8(bufferPosition), cmdValues = tag.getTagValues(opCode, receivedView, bufferPosition - 1, length), cmdValues) : opCode > 127 && opCode < 162 ? (length = receivedView.getUint8(bufferPosition), cmdValues = layer.getLayerValues(opCode, receivedView, bufferPosition - 1, length), cmdValues) : {
                    
CMD: opCode,
                    MESSAGE: "@TODO - opCode not implemented"
                };
            }
            var method = receivedView.getUint8(bufferPosition + 1);
            if (method === 2) return {
                CMD: "auth_passwd"
            };
        }, response = {
            checkHeader: function(buffer) {
                var receivedView = new DataView(buffer), bufferPosition = 0, version = receivedView.getUint8(bufferPosition) >> 4;
                return bufferPosition += 2, version !== 1 ? !1 : !0;
            },
            parse: function(buffer) {
                var opCode, cmdLen, result, receivedView = new DataView(buffer), bufferPosition = 2, message_len = receivedView.getUint16(bufferPosition);
                bufferPosition += 2, result = [];
                while (bufferPosition < message_len - 1) opCode = receivedView.getUint8(bufferPosition), bufferPosition += 1, cmdLen = receivedView.getUint8(bufferPosition), cmdLen > 2 && result.push(checkOpCode
(opCode, receivedView, bufferPosition)), bufferPosition += cmdLen - 1;
                return result;
            }
        };
        return response;
    }), define("user", [], function() {
        var user = {
            auth: function(name, method, passwd) {
                var i, cmdLen;
                if (method === 1) cmdLen = 3 + name.length + 1; else {
                    if (method !== 2) return null;
                    cmdLen = 3 + name.length + 1 + 1 + passwd.length;
                }
                var buf = new ArrayBuffer(cmdLen), view = new DataView(buf);
                view.setUint8(0, 7), view.setUint8(1, cmdLen), view.setUint8(2, name.length);
                for (i = 0; i < name.length; i++) view.setUint8(3 + i, name.charCodeAt(i));
                view.setUint8(3 + name.length, method);
                if (method === 2) {
                    view.setUint8(3 + name.length + 1, passwd.length);
                    for (i = 0; i < passwd.length; i++) view.setUint8(3 + 
name.length + 2 + i, passwd.charCodeAt(i));
                }
                return buf;
            }
        };
        return user;
    }), define("wsocket", [ "request", "response", "negotiation", "node", "user", "taggroup", "layer" ], function(request, response, negotiation, node, user, tagGroup, layer) {
        window.WebSocket = window.WebSocket || window.MozWebSocket;
        var myWebscoket, wsocket, onSocketMessage, onSocketError, onSocketConnect, onSocketClose, userAuthNone, userInfo = {}, confirmHost, userAuthData;
        return window.onbeforeunload = function() {
            myWebscoket.onclose = function() {}, myWebscoket.close();
        }, onSocketError = function onSocketError(event) {
            console.error("Error:" + event.data);
        }, onSocketConnect = function onSocketConnect(event, config) {
            console.log("[Connected] " + event.code), userAuthNone(config);
        }, onSocketClose = function onSocketClose(event, config) {
            config && 
config.connectionTerminatedCallback && typeof config.connectionTerminatedCallback == "function" && config.connectionTerminatedCallback(event);
        }, userAuthNone = function userAuthNone(config) {
            var buf = user.auth(config.username, 1, "");
            buf = request.message(buf), myWebscoket.send(buf);
        }, userAuthData = function userAuthData(config) {
            var buf = user.auth(config.username, 2, config.passwd);
            buf = request.message(buf), myWebscoket.send(buf);
        }, confirmHost = function confirmHost(responseData) {
            var buf = negotiation.url(negotiation.CHANGE_R, myWebscoket.url);
            buf = request.buffer_push(buf, negotiation.token(negotiation.CONFIRM_R, responseData[1].VALUE)), buf = request.buffer_push(buf, negotiation.token(negotiation.CHANGE_R, "^DD31*$cZ6#t")), buf = request.buffer_push(buf, negotiation.ded(negotiation.CONFIRM_L, responseData[2].VALUE)), buf = request.message(buf), myWebscoket.send(buf);
        
}, onSocketMessage = function onSocketMessage(message, config) {
            var responseData;
            if (message.data instanceof ArrayBuffer) {
                if (!response.checkHeader(message.data)) {
                    myWebscoket.close();
                    return;
                }
                responseData = response.parse(message.data), responseData.forEach(function(cmd) {
                    cmd.CMD === "auth_passwd" ? userAuthData(config) : cmd.CMD === "auth_succ" ? (confirmHost(responseData), userInfo = cmd) : cmd.CMD === "CONFIRM_R" && cmd.FEATURE === "HOST_URL" ? (wsocket.subscribeNode(0), config.connectionAcceptedCallback(userInfo)) : config.dataCallback(cmd);
                });
            }
        }, wsocket = {
            init: function(config) {
                console.info("Connecting to URI:" + config.uri + " ..."), myWebscoket = new WebSocket(config.uri, config.version), myWebscoket.binaryType = "arraybuffer", myWebscoket.addEventListener("error", onSocketError
), myWebscoket.addEventListener("close", onSocketClose), myWebscoket.addEventListener("open", function(evnt) {
                    onSocketConnect(evnt, config);
                }), myWebscoket.addEventListener("message", function(msg) {
                    onSocketMessage(msg, config);
                });
            },
            subscribeNode: function subscribeNode(nodeId) {
                var buf = node.subscribe(nodeId);
                buf = request.message(buf), myWebscoket.send(buf);
            },
            subscribeTagGroup: function subscribeNode(nodeId, tagGroupId) {
                var buf = tagGroup.subscribe(nodeId, tagGroupId);
                buf = request.message(buf), myWebscoket.send(buf);
            },
            subscribeLayer: function subscribeNode(nodeId, layerId) {
                var buf = layer.subscribe(nodeId, layerId);
                buf = request.message(buf), myWebscoket.send(buf);
            }
        }, wsocket;
    }), require([ "wsocket" ]);

})();;