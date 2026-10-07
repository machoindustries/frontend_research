define([
    "dojo/_base/array",
    "dojo/_base/declare",
    "dojo/_base/lang"
], function(
    array,
    declare,
    lang
) {

    return declare("app.CacheManager", null, {
        _data: null,
        _cacheLength: null,
        _length: null,

        constructor: function (args) {
            this._data = {};
            this._cacheLength = 50;
            this._length = 0;
        },

        add: function(key, value) {
            if (this._length > this._cacheLength) {
                this.flush();
            }

            if (!this._data[key]) {
                this._length++;
            }

            this._data[key] = value;
        },

        load: function(key) {
            if (this._length < 1) {
                return null;
            }

            if (this._data[key]) {
                return this._data[key];
            }

            return null;
        },

        flush: function() {
            this._data = {};
            this._length = 0;
        }
    });
});