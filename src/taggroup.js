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

define(['command'], function(command) {
    'use strict';

    var commands, routines, tagGroup, sendSubUnsub, getSubUnsub;

    /*
     * subscibe and ubsucribe tagGroup
     */
    sendSubUnsub = function sendSubUnsub(opCode, nodeId, tagGroupId) {
        var cmd, view;
        cmd = command.template(17, opCode);
        view = new DataView(cmd);
        view.setUint8(3, 0); //share
        view.setUint32(3, nodeId);
        view.setUint16(7, tagGroupId);
        view.setUint32(9, 0); //Version
        view.setUint32(13, 0); //CRC32
        return cmd;
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
         * commad to create tag group at server
         * @param nodeId int32
         * @param customType int16
         */
        create: function(nodeId, customType) {
            var cmd, view;
            cmd = command.template(11, 64);
            view = new DataView(cmd);
            view.setUint8(3, 0); //share
            view.setUint32(3, nodeId);
            view.setUint16(7, 65535); // tagGroup ID will be defined by server
            view.setUint16(9, customType);
            return cmd;
        },

        /*
         * command to destroy tag group at server
         * @param nodeId int32
         * @param tagGroupId int16
         */
        destroy: function(nodeId, tagGroupId) {
            var cmd, view;
            cmd = command.template(9, 65);
            view = new DataView(cmd);
            view.setUint8(3, 0); //share
            view.setUint32(3, nodeId);
            view.setUint16(7, tagGroupId);
            return cmd;
        },

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
