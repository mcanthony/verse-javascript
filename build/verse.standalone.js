(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        //Allow using this built library as an AMD module
        //in another project. That other project will only
        //see this AMD call, not the internal modules in
        //the closure below.
        define([], factory);
    } else {
        //Browser globals case. Just assign the
        //result to a property on the global.
        root.verse = factory();
    }
}(this, function () {/**
 * @license almond 0.2.9 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                name = baseParts.concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("../bower_components/almond/almond", function(){});

/*
 * Verse Websocket Asynchronous Module 
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

/* globals ArrayBuffer, define, */

define('request',[],function() {
    


    var request = {

        /*
         * Add verse protocol header before payload
         * @param payload ArrayBuffer
         */
        message: function message(payload) {
            var messageLen, buf, view, payloadView;

            messageLen = 4 + payload.byteLength;
            buf = new ArrayBuffer(messageLen);
            view = new DataView(buf);
            payloadView = new DataView(payload);

            /* Verse header starts with version */
            /* First 4 bits are reserved for version of protocol */
            view.setUint8(0, 1 << 4);
            /* The length of the message */
            view.setUint16(2, messageLen);

            /* then byte copy the payload to new buffer */
            for (var i = 0; i < payload.byteLength; i++) {
                    view.setUint8(i + 4, payloadView.getUint8(i));
            }
            
            return buf;
        },

        /*
         * Concatenate two buffers and return new buffer
         * @param bufferA
         * @param bufferB
         */
        buffer_push: function buffer_push(bufferA, bufferB) {
            var result, viewResult, viewA, viewB, i, j, messageLen;

            messageLen = bufferA.byteLength + bufferB.byteLength;
            result = new ArrayBuffer(messageLen);
            viewResult = new DataView(result);
            viewA = new DataView(bufferA);
            viewB = new DataView(bufferB);
             
            /*  byte copy the first buffer to result buffer */
            for (i = 0; i < bufferA.byteLength; i++) {
                    viewResult.setUint8(i, viewA.getUint8(i));
            }

            /*  byte copy the first buffer to result buffer */
            for (j = bufferA.byteLength;  j < messageLen; j++) {
                    viewResult.setUint8(j, viewB.getUint8(j - bufferA.byteLength));
            }
            
            return result;

        }


    };

    return request;

});

/*
 * Verse Websocket Asynchronous Module 
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

/*globals ArrayBuffer, define*/

define('negotiation',[],function() {
    

    var negotiation, sendStringMessage, sendIntMessage;

    /**
     * Abstract string message array buffer
     * @param messageType int
     * @param payload string
     * @param featureType int
     **/
    sendStringMessage = function(messageType, payload, featureType) {
        var buf, view, messageLen, i;

        messageLen = 3 + 1 + payload.length;
        buf = new ArrayBuffer(messageLen);
        view = new DataView(buf);
        /* first byte - message type */
        view.setUint8(0, messageType);
        /* second byte - message length */
        view.setUint8(1, messageLen);
        /* third byte - feature type */
        view.setUint8(2, featureType);
        /* fourth byte - length of packed string */
        view.setUint8(3, payload.length);

        //console.info(payload);
        /* Pack the payload */
        for (i = 0; i < payload.length; i++) {
            //console.info(payload[i]);
            
            view.setUint8(4 + i, payload.charCodeAt(i));
        }

        return buf;
    };

    /**
     * Abstract int message array buffer
     * @param messageType int
     * @param payload int
     * @param featureType int
     **/

    sendIntMessage = function(messageType, payload, featureType) {
        var buf, view;

        buf = new ArrayBuffer(4);
        view = new DataView(buf);
        /* first byte - message type */
        view.setUint8(0, messageType);
        /* second byte - message length */
        view.setUint8(1, 4);
        /* third byte - feature type */
        view.setUint8(2, featureType);
        /* fourth byte - id */
        view.setUint8(3, payload);

        return buf;
    };

    /*
     * Parses received ArrayBuffer, find correct feature name and value
     * @param feature - int feature number
     * @param  receivedView - DataView for received buffer
     * @param bufferPosition - int current reading posititon
     * @param lenght - lenght of command
     */
    var parseFeature = function parseFeature(feature, receivedView, bufferPosition, length) {
        var value,
            stringFeatures = {
                3: 'HOST_URL',
                4: 'TOKEN',
                5: 'DED',
                9: 'CLIENT_NAME',
                10: 'CLIENT_VERSION'
            },
            intFeatures = {
                1: 'FCID',
                2: 'CCID',
                6: 'RWIN',
                8: 'COMMAND_COMPRESSION'
            };



        if (feature in stringFeatures) { /* got token */
            value = parseStringValue(receivedView, length, bufferPosition);
            return {
                FEATURE: stringFeatures[feature],
                VALUE: value
            };
        } else if (feature in intFeatures){
            return {
                FEATURE: intFeatures[feature],
                VALUE: receivedView.getUint8(7)
            };
        } else {
            return {
                FEATURE: feature,
                VALUE: 'TBD'
            };
        }
    };

    /*
     * Parses received ArrayBuffer returns stored string value
     * @param  receivedDataView - DataView for received buffer
     * @param bufferPosition - int current reading posititon
     * @param lenght - lenght of command
     */

    var parseStringValue = function parseStringValue(receivedDataView, length, bufferPosition) {
        var i, result = '';
        for (i = 0; i <= length - 4; i++) {
            result += String.fromCharCode(receivedDataView.getUint8(bufferPosition + 2 + i));
        }
        return result.slice(1);
    };

    /*
    * negotiation module
    */ 

    negotiation = {

        /* message types */
        CHANGE_L: 3,
        CHANGE_R: 4,
        CONFIRM_L: 5,
        CONFIRM_R: 6,

        getFeatureValues: function getFeatureValues(feature, receivedView, bufferPosition, length) {
            return parseFeature(feature, receivedView, bufferPosition, length);
        },

        /*
         * Flow Control ID (FCID)
         * feature type 1
         * @param type : int message type
         * @param id : fcid Value range: 0 - 255
         */
        fcid: function(type, id) {
            return sendIntMessage(type, id, 1);
        },

        /*
         * Congestion Control ID (CCID)
         * feature type 2
         * @param type : int message type
         * @param id : fcid Value range: 0 - 255
         */
        ccid: function(type, id) {
            return sendIntMessage(type, id, 2);
        },

        /*
         * URL of host defined in RFC 1738
         * feature type 3
         * @param type : int message type
         * @param nurl : string
         */
        url: function(type, nurl) {
            return sendStringMessage(type, nurl, 3);
        },

        /*
         * Token
         * feature type 4
         * @param type : int message type
         * @param tokenString : string
         */
        token: function(type, tokenString) {
            return sendStringMessage(type, tokenString, 4);
        },


        /*
         * Data Exchange Definition (DED)
         * feature type 5
         * @param type : int message type
         * @param dedString : string
         */
        ded: function(type, dedString) {
            return sendStringMessage(type, dedString, 5);
        },

        /*
         * Scale factor of RWIN used in Flow Control
         * feature type 6
         * @param type : int message type
         * @param id : rwin Value range: 0 - 255
         */
        rwin: function(type, value) {
            return sendIntMessage(type, value, 6);
        },

        /*
         * Frames per Seconds
         * feature type 7
         * @param type : int message type
         * @param fps: float Value range: Float min - Float max
         */

        fps: function(messageType, value) {
            var buf, view;

            buf = new ArrayBuffer(7);
            view = new DataView(buf);
            /* first byte - message type */
            view.setUint8(0, messageType);
            /* second byte - message length */
            view.setUint8(1, 7);
            /* third byte - feature type */
            view.setUint8(2, 7);
            /* fourth byte - value */
            view.setFloat32(3, value);

            return buf;
        },

        /*
         * Command Compression
         * feature type 8
         * @param type : int message type
         * @param id : compress Value range: 0 - 255
         */
        compression: function(type, value) {
            return sendIntMessage(type, value, 8);
        }



    };

    return negotiation;

});

/*
 * Verse Websocket Asynchronous Module 
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

/* globals ArrayBuffer, define */

define('message',[],function() {
    

    var message;


    /**
     * Abstract message array buffer
     **/

    message = {

        /**
         * basic mesage template
         * @param opcode int
         * @param length int
         **/

        template: function(length, opCode) {
            var buf, view;

            buf = new ArrayBuffer(length);
            view = new DataView(buf);
            /* first byte - op code*/
            view.setUint8(0, opCode);
            /* second byte - message length */
            view.setUint8(1, length);

            return buf;
        }
    };

    return message;

});

/*
 * Verse Websocket Asynchronous Module 
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

/* globals define */

define('node',['message'], function(message) {
    

    var node, commands, routines;

    //command codes = opCodes
    commands = {
        32: 'NODE_CREATE',
        33: 'NODE_DESTROY',
        34: 'NODE_SUBSCRIBE',
        35: 'NODE_UNSUBSCRIBE',
        37: 'NODE_LINK',
        38: 'NODE_PERMISIONS',
        39: 'NODE_UMASK',
        40: 'NODE_OWNER',
        41: 'NODE_LOCK',
        42: 'NODE_UNLOCK',
        43: 'NODE_PRIORITY'
    };

    /*
     * routines - parsing functions for node commands from server
     */

    routines = {
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
                CMD: commands[opCode],
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
                CHILD_ID: receivedView.getUint32(bufferPosition + 7)
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
                SHARE: receivedView.getUint8(bufferPosition + 2),
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

    };

    node = {

        /*
         * subscribe node commad
         * @param id - node id
         */
        subscribe: function(id) {
            var msg, view;
            msg = message.template(14, 34);
            view = new DataView(msg);
            view.setUint32(2, id);
            view.setUint32(6, 0);
            view.setUint32(10, 0);
            return msg;
        },

        getNodeValues: function getNodeValues(opCode, receivedView, bufferPosition, length) {
            var result = routines[opCode](opCode, receivedView, bufferPosition, length);
            return result;


        }





    };

    return node;

});

/*
 * Verse Websocket Asynchronous Module 
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

/* globals define */

define('taggroup',['message'], function(message) {
    

    var commands, routines, tagGroup, sendSubUnsub, getSubUnsub;

    /*
     * subscibe and ubsucribe tagGroup
     */

    sendSubUnsub = function sendSubUnsub(opCode, nodeId, tagGroupId) {
        var msg, view;
        msg = message.template(17, opCode);
        view = new DataView(msg);
        view.setUint8(3, 0); //share
        view.setUint32(3, nodeId);
        view.setUint16(7, tagGroupId);
        view.setUint32(9, 0); //Version
        view.setUint32(13, 0); //CRC32
        return msg;
    };


    getSubUnsub = function getSubUnsub(opCode, receivedView, bufferPosition) {
        return {
            CMD: commands[opCode],
            SHARE: receivedView.getUint8(bufferPosition + 2),
            NODE_ID: receivedView.getUint32(bufferPosition + 3),
            TAG_GROUP_ID: receivedView.getUint16(bufferPosition + 7),
            VERSION: receivedView.getUint32(bufferPosition + 9),
            CRC32: receivedView.getUint32(bufferPosition + 13)
        };
    };

    //command codes = opCodes
    commands = {
        64: 'TAG_GROUP_CREATE',
        65: 'TAG_GROUP_DESTROY',
        66: 'TAG_GROUP_SUBSCRIBE',
        67: 'TAG_GROUP_UNSUBSCRIBE'
    };

    /*
     * routines - parsing functions for node commands from server
     */

    routines = {
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

    };

    tagGroup = {

        /*
         * subscribe tagGroup commad OpCode 46
         * @param nodeId int32
         * @param tagGroupId int16
         */
        subscribe: function(nodeId, tagGroupId) {
            return sendSubUnsub(66, nodeId, tagGroupId);
        },

        /*
         * unsubscribe tagGroup commad OpCode 47
         * @param nodeId int32
         * @param tagGroupId int16
         */

        unsubscribe: function(nodeId, tagGroupId) {
            return sendSubUnsub(67, nodeId, tagGroupId);
        },

        /*
         * parse received buffer for tagGroup command values
         */

        getTagGroupValues: function getTagGroupValues(opCode, receivedView, bufferPosition, length) {
            var result = routines[opCode](opCode, receivedView, bufferPosition, length);
            return result;
        }

    };

    return tagGroup;

});

//     Int64.js
//
//     Copyright (c) 2012 Robert Kieffer
//     MIT License - http://opensource.org/licenses/mit-license.php

/**
 * Support for handling 64-bit int numbers in Javascript (node.js)
 *
 * JS Numbers are IEEE-754 binary double-precision floats, which limits the
 * range of values that can be represented with integer precision to:
 *
 * 2^^53 <= N <= 2^53
 *
 * Int64 objects wrap a node Buffer that holds the 8-bytes of int64 data.  These
 * objects operate directly on the buffer which means that if they are created
 * using an existing buffer then setting the value will modify the Buffer, and
 * vice-versa.
 *
 * Internal Representation
 *
 * The internal buffer format is Big Endian.  I.e. the most-significant byte is
 * at buffer[0], the least-significant at buffer[7].  For the purposes of
 * converting to/from JS native numbers, the value is assumed to be a signed
 * integer stored in 2's complement form.
 *
 * For details about IEEE-754 see:
 * http://en.wikipedia.org/wiki/Double_precision_floating-point_format
 */

/* globals define */

define('Int64',[],function() {
    


    //
    // Int64
    //

    /**
     * Constructor accepts any of the following argument types:
     *
     * new Int64(buffer[, offset=0]) - Existing Buffer with byte offset
     * new Int64(string)             - Hex string (throws if n is outside int64 range)
     * new Int64(number)             - Number (throws if n is outside int64 range)
     * new Int64(hi, lo)             - Raw bits as two 32-bit values
     */
    var Int64 = function(a1, offset) {
        offset = offset || 0;
        if (a1 instanceof Array) {
            this.storage = a1.slice(offset, 8);
        } else {
            this.storage = this.storage || new Array(8);
            this.setValue.apply(this, arguments);
        }
    };


    // Max integer value that JS can accurately represent
    Int64.MAX_INT = Math.pow(2, 53);

    // Min integer value that JS can accurately represent
    Int64.MIN_INT = -Math.pow(2, 53);

    Int64.HexTable = new Array(256);
    for (var i = 0; i < 256; i++) {
        Int64.HexTable[i] = (i > 0xF ? '' : '0') + i.toString(16);
    }

    Int64.prototype = {
        /**
         * Do in-place 2's compliment.  See
         * http://en.wikipedia.org/wiki/Two's_complement
         */
        _2scomp: function() {
            var b = this.storage,
                o = o,
                carry = 1;
            for (var i = o + 7; i >= o; i--) {
                var v = (b[i] ^ 0xff) + carry;
                b[i] = v & 0xff;
                carry = v >> 8;
            }
        },

        /**
         * Set the value. Takes any of the following arguments:
         *
         * setValue(string) - A hexidecimal string
         * setValue(number) - Number (throws if n is outside int64 range)
         * setValue(hi, lo) - Raw bits as two 32-bit values
         */
        setValue: function(hi, lo) {
            var negate = false;
            if (arguments.length === 1) {
                if (typeof(hi) === 'number') {
                    // Simplify bitfield retrieval by using abs() value.  We restore sign
                    // later
                    negate = hi < 0;
                    hi = Math.abs(hi);
                    lo = hi % 0x80000000;
                    hi = hi / 0x80000000;
                    if (hi > 0x80000000) {
                        throw new RangeError(hi + ' is outside Int64 range');
                    }
                    hi = hi | 0;
                } else if (typeof(hi) === 'string') {
                    hi = (hi + '').replace(/^0x/, '');
                    lo = hi.substr(-8);
                    hi = hi.length > 8 ? hi.substr(0, hi.length - 8) : '';
                    hi = parseInt(hi, 16);
                    lo = parseInt(lo, 16);
                } else {
                    throw new Error(hi + ' must be a Number or String');
                }
            }

            // Technically we should throw if hi or lo is outside int32 range here, but
            // it's not worth the effort. Anything past the 32'nd bit is ignored.

            // Copy bytes to buffer
            var b = this.storage,
                o = 0;
            for (var i = 7; i >= 0; i--) {
                b[o + i] = lo & 0xff;
                lo = i === 4 ? hi : lo >>> 8;
            }

            // Restore sign of passed argument
            if (negate) {
                this._2scomp();
            }
        },

        /**
         * Convert to a native JS number.
         *
         * WARNING: Do not expect this value to be accurate to integer precision for
         * large (positive or negative) numbers!
         *
         * @param allowImprecise If true, no check is performed to verify the
         * returned value is accurate to integer precision.  If false, imprecise
         * numbers (very large positive or negative numbers) will be forced to +/-
         * Infinity.
         */
        toNumber: function(allowImprecise) {
            var b = this.storage,
                o = 0;

            // Running sum of octets, doing a 2's complement
            var negate = b[0] & 0x80,
                x = 0,
                carry = 1;
            for (var i = 7, m = 1; i >= 0; i--, m *= 256) {
                var v = b[o + i];

                // 2's complement for negative numbers
                if (negate) {
                    v = (v ^ 0xff) + carry;
                    carry = v >> 8;
                    v = v & 0xff;
                }

                x += v * m;
            }

            // Return Infinity if we've lost integer precision
            if (!allowImprecise && x >= Int64.MAX_INT) {
                return negate ? -Infinity : Infinity;
            }

            return negate ? -x : x;
        },

        /**
         * Convert to a JS Number. Returns +/-Infinity for values that can't be
         * represented to integer precision.
         */
        valueOf: function() {
            return this.toNumber(false);
        },

        /**
         * Return string value
         *
         * @param radix Just like Number#toString()'s radix
         */
        toString: function(radix) {
            return this.valueOf().toString(radix || 10);
        },

        /**
         * Return a string showing the buffer octets, with MSB on the left.
         *
         * @param sep separator string. default is '' (empty string)
         */
        toOctetString: function(sep) {
            var out = new Array(8);
            var b = this.storage,
                o = 0;
            for (var i = 0; i < 8; i++) {
                out[i] = Int64.HexTable[b[o + i]];
            }
            return out.join(sep || '');
        }
    };

    return Int64;

});

/*
 * Verse Websocket Asynchronous Module 
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

/* globals define */

define('tag',['Int64'], function(Int64) {
    

    var commands, routines, tag, getTagSetCommons, getTagSetUint8, getTagSetUint16,
        getTagSetUint32, getTagSetUint64, getTagSetFloat16,
        getTagSetFloat32, getTagSetFloat64, getTagSetString8;

    /*
    * common function for all tagSet commands 
    */

    getTagSetCommons = function getTagSetCommons(opCode, receivedView, bufferPosition) {
        return {
            CMD: commands[opCode],
            SHARE: receivedView.getUint8(bufferPosition + 2),
            NODE_ID: receivedView.getUint32(bufferPosition + 3),
            TAG_GROUP_ID: receivedView.getUint16(bufferPosition + 7),
            TAG_ID: receivedView.getUint16(bufferPosition + 9),
            VALUES: []
        };
    };

    /*
    * common function for all SetUint8 opCodes
    * @param opCode int from interval 70 - 73
    */

    getTagSetUint8 = function getTagSetUint8(opCode, receivedView, bufferPosition) {
        
        var result = getTagSetCommons(opCode, receivedView, bufferPosition);

        result.VALUES[0] = receivedView.getUint8(bufferPosition + 11);

        if (opCode > 70) {
            result.VALUES[1] = receivedView.getUint8(bufferPosition + 12);   
        }

        if (opCode > 71) {
            result.VALUES[2] = receivedView.getUint8(bufferPosition + 13);   
        }

        if (opCode > 72) {
            result.VALUES[3] = receivedView.getUint8(bufferPosition + 14);   
        }

        return result;
    };

    /*
    * common function for all SetUint16 opCodes
    * @param opCode int from interval 74 - 77
    */

    getTagSetUint16 = function getTagSetUint16(opCode, receivedView, bufferPosition) {
        var result = getTagSetCommons(opCode, receivedView, bufferPosition);

        result.VALUES[0] = receivedView.getUint16(bufferPosition + 11);

        if (opCode > 74) {
            result.VALUES[1] = receivedView.getUint16(bufferPosition + 13);   
        }

        if (opCode > 75) {
            result.VALUES[2] = receivedView.getUint16(bufferPosition + 15);   
        }

        if (opCode > 76) {
            result.VALUES[3] = receivedView.getUint16(bufferPosition + 17);   
        }

        return result;
    };

    /*
    * common function for all SetUint32 opCodes
    * @param opCode int from interval 78 - 81
    */

    getTagSetUint32 = function getTagSetUint32(opCode, receivedView, bufferPosition) {
        var result = getTagSetCommons(opCode, receivedView, bufferPosition);

        result.VALUES[0] = receivedView.getUint32(bufferPosition + 11);

        if (opCode > 78) {
            result.VALUES[1] = receivedView.getUint32(bufferPosition + 15);   
        }

        if (opCode > 79) {
            result.VALUES[2] = receivedView.getUint32(bufferPosition + 19);   
        }

        if (opCode > 80) {
            result.VALUES[3] = receivedView.getUint32(bufferPosition + 23);   
        }

        return result;
    };

    /*
    * common function for all SetUint64 opCodes
    * WARNING > conversion by valueOf fails if the number is bigger than 2^53
    * @param opCode int from interval 82 - 85
    *
    */

    getTagSetUint64 = function getTagSetUint64(opCode, receivedView, bufferPosition) {
        var result, hi, lo, bigNumber;

        result = getTagSetCommons(opCode, receivedView, bufferPosition);

        lo = receivedView.getUint32(bufferPosition + 11);
        hi = receivedView.getUint32(bufferPosition + 15); 
        bigNumber = new Int64(hi, lo);
        result.VALUES[0] = bigNumber.valueOf();

        if (opCode > 82) {
            lo = receivedView.getUint32(bufferPosition + 19);
            hi = receivedView.getUint32(bufferPosition + 23); 
            bigNumber = new Int64(hi, lo);
            result.VALUES[1] = bigNumber.valueOf();
        }

        if (opCode > 83) {
            lo = receivedView.getUint32(bufferPosition + 27);
            hi = receivedView.getUint32(bufferPosition + 31); 
            bigNumber = new Int64(hi, lo);
            result.VALUES[2] = bigNumber.valueOf();
        }

        if (opCode > 84) {
            lo = receivedView.getUint32(bufferPosition + 35);
            hi = receivedView.getUint32(bufferPosition + 39); 
            bigNumber = new Int64(hi, lo);
            result.VALUES[3] = bigNumber.valueOf();
        }

        return result;
    };

    /*
    * common function for all SetReal32 opCodes
    * @param opCode int from interval 90 - 93
    */

    getTagSetFloat16 = function getTagSetFloat16(opCode, receivedView, bufferPosition) {
        var result = getTagSetCommons(opCode, receivedView, bufferPosition);

        result.VALUES[0] = '@TODO > Float16 not supported';

        return result;
    };

    /*
    * common function for all SetReal32 opCodes
    * @param opCode int from interval 90 - 93
    */

    getTagSetFloat32 = function getTagSetFloat32(opCode, receivedView, bufferPosition) {
        var result = getTagSetCommons(opCode, receivedView, bufferPosition);

        result.VALUES[0] = receivedView.getFloat32(bufferPosition + 11);

        if (opCode > 90) {
            result.VALUES[1] = receivedView.getFloat32(bufferPosition + 15);   
        }

        if (opCode > 91) {
            result.VALUES[2] = receivedView.getFloat32(bufferPosition + 19);   
        }

        if (opCode > 92) {
            result.VALUES[3] = receivedView.getFloat32(bufferPosition + 23);   
        }

        return result;
    };

    /*
    * common function for all SetReal64 opCodes
    * @param opCode int from interval 94 - 97
    */

    getTagSetFloat64 = function getTagSetFloat64(opCode, receivedView, bufferPosition) {
        var result = getTagSetCommons(opCode, receivedView, bufferPosition);

        result.VALUES[0] = receivedView.getFloat64(bufferPosition + 11);

        if (opCode > 94) {
            result.VALUES[1] = receivedView.getFloat64(bufferPosition + 19);   
        }

        if (opCode > 95) {
            result.VALUES[2] = receivedView.getFloat64(bufferPosition + 27);   
        }

        if (opCode > 96) {
            result.VALUES[3] = receivedView.getFloat64(bufferPosition + 35);   
        }

        return result;
    };

    /*
    * common function for all SetReal64 opCodes
    * @param opCode int from interval 94 - 97
    */

    getTagSetString8 = function getTagSetString8(opCode, receivedView, bufferPosition) {
        var i, strLength, result;

        result = getTagSetCommons(opCode, receivedView, bufferPosition);
        delete result.VALUES;
        result.VALUE = '';

        strLength = receivedView.getUint8(11);
        for (i = 0; i < strLength; i++) {
            result.VALUE += String.fromCharCode(receivedView.getUint8(bufferPosition + 12 + i));
        }
        
        return result;
    };



    //command codes = opCodes
    commands = {
        68: 'TAG_CREATE',
        69: 'TAG_DESTROY',
        70: 'TAG_SET_UINT8',
        71: 'TAG_SET_UINT8',
        72: 'TAG_SET_UINT8',
        73: 'TAG_SET_UINT8',
        74: 'TAG_SET_UINT16',
        75: 'TAG_SET_UINT16',
        76: 'TAG_SET_UINT16',
        77: 'TAG_SET_UINT16',
        78: 'TAG_SET_UINT32',
        79: 'TAG_SET_UINT32',
        80: 'TAG_SET_UINT32',
        81: 'TAG_SET_UINT32',
        82: 'TAG_SET_UINT64',
        83: 'TAG_SET_UINT64',
        84: 'TAG_SET_UINT64',
        85: 'TAG_SET_UINT64',
        86: 'TAG_SET_REAL16',
        87: 'TAG_SET_REAL16',
        88: 'TAG_SET_REAL16',
        89: 'TAG_SET_REAL16',
        90: 'TAG_SET_REAL32',
        91: 'TAG_SET_REAL32',
        92: 'TAG_SET_REAL32',
        93: 'TAG_SET_REAL32',
        94: 'TAG_SET_REAL64',
        95: 'TAG_SET_REAL64',
        96: 'TAG_SET_REAL64',
        97: 'TAG_SET_REAL64',
        98: 'TAG_SET_STRING8'
        
    };

    /*
     * routines - parsing functions for tag commands from server
     */

    routines = {
        68: function getTagCreate(opCode, receivedView, bufferPosition) {
            var result;
            result = getTagSetCommons(opCode, receivedView, bufferPosition);
            delete result.VALUES;  
            result.DATA_TYPE = receivedView.getUint8(bufferPosition + 11);
            result.COUNT = receivedView.getUint8(bufferPosition + 12);
            result.CUSTOM_TYPE = receivedView.getUint16(bufferPosition + 13);
            return result;
            
        },
        69: function getTagDestroy(opCode, receivedView, bufferPosition) {
            var result;
            result = getTagSetCommons(opCode, receivedView, bufferPosition);
            delete result.VALUES;    

            return result;
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
        89: getTagSetFloat16,
        90: getTagSetFloat32,
        91: getTagSetFloat32,
        92: getTagSetFloat32,
        93: getTagSetFloat32,
        94: getTagSetFloat64,
        95: getTagSetFloat64,
        96: getTagSetFloat64,
        97: getTagSetFloat64,
        98: getTagSetString8

    };

    tag = {


        /*
         * parse received buffer for tag command VALUES
         */

        getTagValues: function getTagValues(opCode, receivedView, bufferPosition, length) {
            var result = routines[opCode](opCode, receivedView, bufferPosition, length);
            return result;
        }

    };

    return tag;

});

/*
 * Verse Websocket Asynchronous Module 
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

/* globals define */

define('layer',['message', 'Int64'], function(message, Int64) {
    

    var commands, routines, layer, getLayerCreateCommons, getLayerSetUint8, getLayerSetUint16,
        getLayerSetUint32, getLayerSetUint64, getLayerSetFloat16, getLayerSetFloat32, getLayerSetFloat64,
        getLayerCmdCommons, getLayerSubUnsub, sendLayerSubUnsub;

    /*
     * common function for layer Create and Destroy commands
     */

    getLayerCreateCommons = function getLayerCreateCommons(opCode, receivedView, bufferPosition) {
        return {
            CMD: commands[opCode],
            SHARE: receivedView.getUint8(bufferPosition + 2),
            NODE_ID: receivedView.getUint32(bufferPosition + 3),
            PARENT_LAYER_ID: receivedView.getUint16(bufferPosition + 7),
            LAYER_ID: receivedView.getUint16(bufferPosition + 9)
        };
    };


    /*
     * common parsing function for most of layer commands
     */

    getLayerCmdCommons = function getLayerCmdCommons(opCode, receivedView, bufferPosition) {
        return {
            CMD: commands[opCode],
            SHARE: receivedView.getUint8(bufferPosition + 2),
            NODE_ID: receivedView.getUint32(bufferPosition + 3),
            LAYER_ID: receivedView.getUint16(bufferPosition + 7),
            ITEM_ID: receivedView.getUint32(bufferPosition + 9)
        };
    };


    /*
     * common function for all SetUint8 opCodes
     * @param opCode int from interval 133 - 136
     */

    getLayerSetUint8 = function getLayerSetUint8(opCode, receivedView, bufferPosition) {

        var result = getLayerCmdCommons(opCode, receivedView, bufferPosition);

        result.VALUES = [];
        result.VALUES[0] = receivedView.getUint8(bufferPosition + 13);

        if (opCode > 133) {
            result.VALUES[1] = receivedView.getUint8(bufferPosition + 14);
        }

        if (opCode > 134) {
            result.VALUES[2] = receivedView.getUint8(bufferPosition + 15);
        }

        if (opCode > 135) {
            result.VALUES[3] = receivedView.getUint8(bufferPosition + 16);
        }

        return result;
    };

    /*
     * common function for all SetUint16 opCodes
     * @param opCode int from interval 137 - 140
     */

    getLayerSetUint16 = function getLayerSetUint16(opCode, receivedView, bufferPosition) {
        var result = getLayerCmdCommons(opCode, receivedView, bufferPosition);

        result.VALUES = [];
        result.VALUES[0] = receivedView.getUint16(bufferPosition + 13);

        if (opCode > 137) {
            result.VALUES[1] = receivedView.getUint16(bufferPosition + 15);
        }

        if (opCode > 138) {
            result.VALUES[2] = receivedView.getUint16(bufferPosition + 17);
        }

        if (opCode > 139) {
            result.VALUES[3] = receivedView.getUint16(bufferPosition + 19);
        }

        return result;
    };

    /*
     * common function for all SetUint32 opCodes
     * @param opCode int from interval 141 - 144
     */

    getLayerSetUint32 = function getLayerSetUint32(opCode, receivedView, bufferPosition) {
        var result = getLayerCmdCommons(opCode, receivedView, bufferPosition);

        result.VALUES = [];
        result.VALUES[0] = receivedView.getUint32(bufferPosition + 13);

        if (opCode > 141) {
            result.VALUES[1] = receivedView.getUint32(bufferPosition + 17);
        }

        if (opCode > 142) {
            result.VALUES[2] = receivedView.getUint32(bufferPosition + 21);
        }

        if (opCode > 143) {
            result.VALUES[3] = receivedView.getUint32(bufferPosition + 25);
        }

        return result;
    };

    /*
    * common function for all SetUint64 opCodes
    * WARNING > conversion by valueOf fails if the number is bigger than 2^53
    * @param opCode int from interval 145 - 148
    *
    */

    getLayerSetUint64 = function getLayerSetUint64(opCode, receivedView, bufferPosition) {
        var result, hi, lo, bigNumber;

        result = getLayerCmdCommons(opCode, receivedView, bufferPosition);

        result.VALUES = [];

        lo = receivedView.getUint32(bufferPosition + 13);
        hi = receivedView.getUint32(bufferPosition + 17); 
        bigNumber = new Int64(hi, lo);
        result.VALUES[0] = bigNumber.valueOf();

        if (opCode > 145) {
            lo = receivedView.getUint32(bufferPosition + 21);
            hi = receivedView.getUint32(bufferPosition + 25); 
            bigNumber = new Int64(hi, lo);
            result.VALUES[1] = bigNumber.valueOf();
        }

        if (opCode > 146) {
            lo = receivedView.getUint32(bufferPosition + 29);
            hi = receivedView.getUint32(bufferPosition + 33); 
            bigNumber = new Int64(hi, lo);
            result.VALUES[2] = bigNumber.valueOf();
        }

        if (opCode > 147) {
            lo = receivedView.getUint32(bufferPosition + 37);
            hi = receivedView.getUint32(bufferPosition + 41); 
            bigNumber = new Int64(hi, lo);
            result.VALUES[3] = bigNumber.valueOf();
        }

        return result;
    };

    /*
     * common function for all SetReal16 opCodes
     * @param opCode int from interval 149 - 152
     */

    getLayerSetFloat32 = function getLayerSetFloat32(opCode, receivedView, bufferPosition) {
         var result = getLayerCmdCommons(opCode, receivedView, bufferPosition);

        result.VALUES = [];
        result.VALUES[0] = '@TODO - data type Real16 not supported';

        return result;
    };

    /*
     * common function for all SetReal32 opCodes
     * @param opCode int from interval 153 - 156
     */

    getLayerSetFloat32 = function getLayerSetFloat32(opCode, receivedView, bufferPosition) {
         var result = getLayerCmdCommons(opCode, receivedView, bufferPosition);

        result.VALUES = [];
        result.VALUES[0] = receivedView.getFloat32(bufferPosition + 13);

        if (opCode > 153) {
            result.VALUES[1] = receivedView.getFloat32(bufferPosition + 17);
        }

        if (opCode > 154) {
            result.VALUES[2] = receivedView.getFloat32(bufferPosition + 21);
        }

        if (opCode > 155) {
            result.VALUES[3] = receivedView.getFloat32(bufferPosition + 25);
        }

        return result;
    };

    /*
     * common function for all SetReal64 opCodes
     * @param opCode int from interval 157 - 160
     */

    getLayerSetFloat64 = function getLayerSetFloat64(opCode, receivedView, bufferPosition) {
         var result = getLayerCmdCommons(opCode, receivedView, bufferPosition);

        result.VALUES = [];
        result.VALUES[0] = receivedView.getFloat64(bufferPosition + 13);

        if (opCode > 157) {
            result.VALUES[1] = receivedView.getFloat64(bufferPosition + 21);
        }

        if (opCode > 158) {
            result.VALUES[2] = receivedView.getFloat64(bufferPosition + 29);
        }

        if (opCode > 159) {
            result.VALUES[3] = receivedView.getFloat64(bufferPosition + 37);
        }

        return result;
    };

     /*
     * common function for Subscribe and UnSubscribe commands
     * @param opCode int from interval 130 - 131
     */

    getLayerSubUnsub = function getLayerSubUnsub(opCode, receivedView, bufferPosition) {
        var result;
        result = getLayerCmdCommons(opCode, receivedView, bufferPosition);
        result.VERSION = result.ITEM_ID;
        delete result.ITEM_ID;
        result.CRC32 = receivedView.getUint32(bufferPosition + 13);
        return result;
    };

    /*
     * Layer subscibe and unsubscribe commands for server
     */

    sendLayerSubUnsub = function sendLayerSubUnsub(opCode, nodeId, layerId) {
        var msg, view;
        msg = message.template(17, opCode);
        view = new DataView(msg);
        view.setUint8(3, 0); //share
        view.setUint32(3, nodeId);
        view.setUint16(7, layerId);
        view.setUint32(9, 0); //Version
        view.setUint32(13, 0); //CRC32
        return msg;
    };


    //command codes = opCodes
    commands = {
        128: 'LAYER_CREATE',
        129: 'LAYER_DESTROY',
        130: 'LAYER_SUBSCRIBE',
        131: 'LAYER_UNSUBSCRIBE',
        132: 'LAYER_UNSET',
        133: 'LAYER_SET_UINT8',
        134: 'LAYER_SET_UINT8',
        135: 'LAYER_SET_UINT8',
        136: 'LAYER_SET_UINT8',
        137: 'LAYER_SET_UINT16',
        138: 'LAYER_SET_UINT16',
        139: 'LAYER_SET_UINT16',
        140: 'LAYER_SET_UINT16',
        141: 'LAYER_SET_UINT32',
        142: 'LAYER_SET_UINT32',
        143: 'LAYER_SET_UINT32',
        144: 'LAYER_SET_UINT32',
        145: 'LAYER_SET_UINT64',
        146: 'LAYER_SET_UINT64',
        147: 'LAYER_SET_UINT64',
        148: 'LAYER_SET_UINT64',
        149: 'LAYER_SET_REAL16',
        150: 'LAYER_SET_REAL16',
        151: 'LAYER_SET_REAL16',
        152: 'LAYER_SET_REAL16',
        153: 'LAYER_SET_REAL32',
        154: 'LAYER_SET_REAL32',
        155: 'LAYER_SET_REAL32',
        156: 'LAYER_SET_REAL32',
        157: 'LAYER_SET_REAL64',
        158: 'LAYER_SET_REAL64',
        159: 'LAYER_SET_REAL64',
        160: 'LAYER_SET_REAL64',
        161: 'LAYER_UNSET_DATA'
        
    };

    /*
     * routines - parsing functions for tag commands from server
     */

    routines = {
        128: function getLayerCreate(opCode, receivedView, bufferPosition) {
            var result;
            result = getLayerCreateCommons(opCode, receivedView, bufferPosition);
            result.DATA_TYPE = receivedView.getUint8(bufferPosition + 11);
            result.COUNT = receivedView.getUint8(bufferPosition + 12);
            result.CUSTOM_TYPE = receivedView.getUint16(bufferPosition + 13);
            return result;

        },
        129: function getLayerDestroy(opCode, receivedView, bufferPosition) {
            var result;
            result = getLayerCreateCommons(opCode, receivedView, bufferPosition);

            return result;
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
        149: getLayerSetFloat16,
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
        

    };

    layer = {

         /*
         * subscribe layer commad OpCode 130
         * @param nodeId int32
         * @param layerId int16
         */
        subscribe: function(nodeId, layerId) {
            return sendLayerSubUnsub(130, nodeId, layerId);
        },

        /*
         * unsubscribe layer commad OpCode 131
         * @param nodeId int32
         * @param layerId int16
         */

        unsubscribe: function(nodeId, layerId) {
            return sendLayerSubUnsub(131, nodeId, layerId);
        },



        /*
         * parse received buffer for tag command VALUES
         */

        getLayerValues: function getLayerValues(opCode, receivedView, bufferPosition, length) {
            var result = routines[opCode](opCode, receivedView, bufferPosition, length);
            return result;
        }

    };

    return layer;

});

/*
 * Verse Websocket Asynchronous Module 
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

/* globals define */

define('response',['negotiation', 'node', 'taggroup', 'tag', 'layer'], function(negotiation, node, tagGroup, tag, layer) {
    

    var checkOpCode = function checkOpCode(opCode, receivedView, bufferPosition) {

        var length, feature, cmdValues, opCodes;


        opCodes = {
            3: 'CHANGE_L',
            4: 'CHANGE_R',
            5: 'CONFIRM_L',
            6: 'CONFIRM_R',
            7: 'USER_AUTH_REQUEST',
            8: 'USER_AUTH_FAILURE',
            9: 'USER_AUTH_SUCCESS'
        };

        if (opCode === 8) { /* Is it command usr_auth_fail */
            var method = receivedView.getUint8(bufferPosition + 1);
            if (method === 2) { /* Password method */
                return {
                    CMD: 'auth_passwd'
                };
            }

        } else if (opCode === 9) { /*user authorized*/
            var userId = receivedView.getUint16(bufferPosition + 1),
                avatar = receivedView.getUint32(bufferPosition + 3);
            return {
                CMD: 'auth_succ',
                USER_ID: userId,
                AVATAR_ID: avatar
            };

        } else if (opCode < 7) { //negotiation commands
            length = receivedView.getUint8(bufferPosition);
            feature = receivedView.getUint8(bufferPosition + 1);

            cmdValues = negotiation.getFeatureValues(feature, receivedView, bufferPosition, length);
            return {
                CMD: opCodes[opCode],
                FEATURE: cmdValues.FEATURE,
                VALUE: cmdValues.VALUE
            };
        } else if (opCode > 31 && opCode < 44) { //node commands
            length = receivedView.getUint8(bufferPosition);
            cmdValues = node.getNodeValues(opCode, receivedView, bufferPosition - 1, length);

            return cmdValues;

        } else if (opCode > 63 && opCode < 68) { //TagGroup commands
            length = receivedView.getUint8(bufferPosition);
            cmdValues = tagGroup.getTagGroupValues(opCode, receivedView, bufferPosition - 1, length);

            return cmdValues;

        } else if (opCode > 67 && opCode < 99) { //Tag commands
            length = receivedView.getUint8(bufferPosition);
            cmdValues = tag.getTagValues(opCode, receivedView, bufferPosition - 1, length);

            return cmdValues;

        }  else if (opCode > 127 && opCode < 162) { //Layer commands
            length = receivedView.getUint8(bufferPosition);
            cmdValues = layer.getLayerValues(opCode, receivedView, bufferPosition - 1, length);

            return cmdValues;

        } else {
            return {
                CMD: opCode,
                MESSAGE: '@TODO - opCode not implemented'
            };
        }

    };




    /*
     * Response module - for parsing server response messages
     */


    var response = {
        checkHeader: function(buffer) {
            /* TODO: do communication here :-) */
            var receivedView = new DataView(buffer);
            var bufferPosition = 0;

            /* Parse header */
            var version = receivedView.getUint8(bufferPosition) >> 4;
            bufferPosition += 2;

            if (version !== 1) {
                return false;
            }

            return true;

        },

        parse: function(buffer) {
            var opCode, cmdLen, result;
            var receivedView = new DataView(buffer);
            var bufferPosition = 2;

            var message_len = receivedView.getUint16(bufferPosition);
            bufferPosition += 2;

            result = [];
            while (bufferPosition < message_len - 1) {
                opCode = receivedView.getUint8(bufferPosition);

                bufferPosition += 1;
                cmdLen = receivedView.getUint8(bufferPosition);

                if (cmdLen > 2) {
                    result.push(checkOpCode(opCode, receivedView, bufferPosition));
                } else {
                    /* TODO end connection */
                }

                bufferPosition += cmdLen - 1;

            }

            return result;

        }


    };

    return response;

});

/*
 * Verse Websocket Asynchronous Module 
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

/* globals ArrayBuffer, define */

define('user',[],function() {
    


    var user = {

        
        /*
         * Pack command for user authentication
         * @param name
         * @param method
         * @param passwd
         */
        auth: function(name, method, passwd) {
            var i;

            /* Fill buffer with data of Verse header and user_auth
             * command */
            var cmdLen;

            if (method === 1) {
                cmdLen = 1 + 1 + 1 + name.length + 1;
            } else if (method === 2) {
                cmdLen = 1 + 1 + 1 + name.length + 1 + 1 + passwd.length;
            } else {
                return null;
            }

            var buf = new ArrayBuffer(cmdLen);
            var view = new DataView(buf);

            /* Pack OpCode of user_auth command */
            view.setUint8(0, 7);
            /* Pack length of the command */
            view.setUint8(1, cmdLen);

            /* Pack length of string */
            view.setUint8(2, name.length);
            /* Pack the string of the username */
            for (i = 0; i < name.length; i++) {
                view.setUint8(3 + i, name.charCodeAt(i));
            }

            /* Pack method type */
            view.setUint8(3 + name.length, method);

            /* Pack auth data */
            if (method === 2) {
                /* Pack password length */
                view.setUint8(3 + name.length + 1, passwd.length);
                /* Pack the string of the password */
                for (i = 0; i < passwd.length; i++) {
                    view.setUint8(3 + name.length + 2 + i, passwd.charCodeAt(i));
                }
            }

            return buf;
        }
    };

    return user;

});

/*
 * Verse Websocket Asynchronous Module 
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

/* jshint browser: true */
/* globals define */


define('verse', ['request', 'response', 'negotiation', 'node', 'user', 'taggroup', 'layer'],
    function(request, response, negotiation, node, user, tagGroup, layer) {

        
        window.WebSocket = window.WebSocket || window.MozWebSocket;
        var myWebscoket,
            verse,
            onSocketMessage,
            onSocketError,
            onSocketConnect,
            onSocketClose,
            userAuthNone,
            userInfo = {},
            confirmHost,
            userAuthData;


        window.onbeforeunload = function() {
            myWebscoket.onclose = function() {}; // disable onclose handler first
            myWebscoket.close();
        };



        /*
         *   hadler for websocket error event
         */
        onSocketError = function onSocketError(event) {
            console.error('Error:' + event.data);
        };

        /*
         *  hadler for websocket connect
         * @param event
         * @param config object
         */
        onSocketConnect = function onSocketConnect(event, config) {
            console.log('[Connected] ' + event.code);
            userAuthNone(config);
        };

        /*
         *  hadler for websocket connection close
         * @param event
         * @param config object
         */
        onSocketClose = function onSocketClose(event, config) {
            if (config && config.connectionTerminatedCallback && typeof config.connectionTerminatedCallback === 'function') {
                config.connectionTerminatedCallback(event);
            }
        };

        /*
         * First step of negotiation process
         * Send command user auth with type NONE
         */

        userAuthNone = function userAuthNone(config) {
            var buf = user.auth(config.username, 1, '');
            buf = request.message(buf);
            myWebscoket.send(buf);
        };

        /*
         * Second step of negotiation process
         * Send command user auth with type PASSWORD
         */

        userAuthData = function userAuthData(config) {

            var buf = user.auth(config.username, 2, config.passwd);
            buf = request.message(buf);
            myWebscoket.send(buf);
        };

        /*
         * confirm values send by server to finish the negotitation process
         * @param responseData list of objects
         */

        confirmHost = function confirmHost(responseData) {
            var buf = negotiation.url(negotiation.CHANGE_R, myWebscoket.url);
            buf = request.buffer_push(buf, negotiation.token(negotiation.CONFIRM_R, responseData[1].VALUE));
            buf = request.buffer_push(buf, negotiation.token(negotiation.CHANGE_R, '^DD31*$cZ6#t'));
            buf = request.buffer_push(buf, negotiation.ded(negotiation.CONFIRM_L, responseData[2].VALUE));

            buf = request.message(buf);

            myWebscoket.send(buf);
        };

        /*
         * handler for received message
         * @param message
         * @param config object
         */
        onSocketMessage = function onSocketMessage(message, config) {
            var responseData;

            if (message.data instanceof ArrayBuffer) {
                if (!response.checkHeader(message.data)) {
                    myWebscoket.close();
                    return;
                }

                responseData = response.parse(message.data);

                responseData.forEach(function(cmd) {
                    if (cmd.CMD === 'auth_passwd') {
                        userAuthData(config);
                    } else if (cmd.CMD === 'auth_succ') {
                        confirmHost(responseData);
                        userInfo = cmd;
                    } else if ((cmd.CMD === 'CONFIRM_R') && (cmd.FEATURE === 'HOST_URL')) {
                        verse.subscribeNode(0);
                        /* pass the user info to callback function */
                        config.connectionAcceptedCallback(userInfo);
                    } else {
                        /* call the callback function from config */
                        config.dataCallback(cmd);
                    }

                });
            }
        };


        /*
         * public API of Verse Websocket module
         */
        verse = {
            init: function(config) {

                console.info('Connecting to URI:' + config.uri + ' ...');

                myWebscoket = new WebSocket(config.uri, config.version);
                myWebscoket.binaryType = 'arraybuffer';

                myWebscoket.addEventListener('error', onSocketError);
                myWebscoket.addEventListener('close', onSocketClose);

                myWebscoket.addEventListener('open', function(evnt) {
                    onSocketConnect(evnt, config);
                });
                myWebscoket.addEventListener('message', function(msg) {
                    onSocketMessage(msg, config);
                });
            },

            /*
             * subscribe node on server
             * @param nodeId int
             */

            subscribeNode: function subscribeNode(nodeId) {
                var buf = node.subscribe(nodeId);
                buf = request.message(buf);
                myWebscoket.send(buf);

            },

            /*
             * subscribe tag_group on server
             * @param nodeId int32
             * @param tagGroupId int16
             */

            subscribeTagGroup: function subscribeNode(nodeId, tagGroupId) {
                var buf = tagGroup.subscribe(nodeId, tagGroupId);
                buf = request.message(buf);
                myWebscoket.send(buf);

            },

            /*
             * subscribe layer on server
             * @param nodeId int32
             * @param layerId int16
             */

            subscribeLayer: function subscribeNode(nodeId, layerId) {
                var buf = layer.subscribe(nodeId, layerId);
                buf = request.message(buf);
                myWebscoket.send(buf);

            }

        };




        return verse;

    });


require(["verse"]);
    //The modules for your project will be inlined above
    //this snippet. Ask almond to synchronously require the
    //module value for 'main' here and return it as the
    //value to use for the public API for the built file.
    return require('verse');
}));