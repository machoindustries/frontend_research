define("epi-cms/widget/DisplayOptionSelector", [
    "dojo/_base/array",
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/when",

    "dijit/MenuSeparator",

    "epi/dependency",

    "epi-cms/widget/SelectorMenuBase",

    // Resouces
    "epi/i18n!epi/cms/nls/episerver.cms.contentediting.editors.contentarea.displayoptions",

    // Widgets used in template
    "epi/shell/widget/RadioMenuItem",

    "app/CacheManager"
], function (
    array,
    declare,
    lang,
    when,

    MenuSeparator,

    dependency,

    SelectorMenuBase,

    // Resouces
    resources,

    RadioMenuItem,

    CacheManager
) {

    return declare([SelectorMenuBase], {
        // summary:
        //      Used for selecting display options for a block in a content area
        //
        // tags:
        //      internal

        // model: [public] epi-cms.contentediting.viewmodel.ContentBlockViewModel
        //      View model for the selector
        model: null,

        // _resources: [private] Object
        //      Resource object used in the template
        headingText: resources.title,

        _rdAutomatic: null,
        _separator: null,

        // Custom properties for hacked implementation.
        supportedDisplayOptions: null,
        _cacheManager: null,

        store: null,

        // Adapted from EPiServer and slightly modified.
        // Added initialization of cache manager.
        postCreate: function () {
            // summary:
            //      Create the selector template and query for display options

            this.inherited(arguments);

            this.own(this._rdAutomatic = new RadioMenuItem({
                label: resources.automatic,
                value: ""
            }));

            this.addChild(this._rdAutomatic);
            this._rdAutomatic.on("change", lang.hitch(this, this._restoreDefault));

            this.own(this._separator = new MenuSeparator({ baseClass: "epi-menuSeparator" }));
            this.addChild(this._separator);

            this._cacheManager = this._getCacheManager();
        },

        // Adapted from EPiServer. No modifications.
        _restoreDefault: function () {
            this.model.modify(function () {
                this.model.set("displayOption", null);
            }, this);
        },

        // Adapted from EPiServer. No modifications.
        _setModelAttr: function (model) {
            this._set("model", model);

            this._setup();
        },

        // Adapted from EPiServer. No modifications.
        _setDisplayOptionsAttr: function (displayOptions) {
            this._set("displayOptions", displayOptions);

            this._setup();
        },

        // Adapted from EPiServer and modified.
        // Called on load and when a display option is selected.
        _setup: function () {

            if (!this.model || !this.displayOptions) {
                return;
            }

            var selectedDisplayOption = this.model.get("displayOption");
            
            this._setSupportedDisplayOptions(selectedDisplayOption);
        },

        // Custom method. Called in _setup method. Calls the rest store to
        // get supported display options. The result is cached.
        _setSupportedDisplayOptions: function (selectedDisplayOption) {
            
            var cacheKey = this._getCacheKey();
            var cachedData = this._cacheManager.load(cacheKey);

            if (cachedData != null) {
                this.supportedDisplayOptions = cachedData;
                this._setMenuItems(this.supportedDisplayOptions, selectedDisplayOption);
                return;
            }

            if (!this.store) {
                var storeRegistry = dependency.resolve("epi.storeregistry");
                this.store = storeRegistry.get("app.supporteddisplayoptions");
            }

            when(this.store.get(this.model.contentLink), lang.hitch(this, function (supportedDisplayOptions) {

                this.supportedDisplayOptions = array.filter(this.displayOptions, function (displayOption) {
                    return array.indexOf(supportedDisplayOptions.options, displayOption.id) > -1;
                });

                // Add to cache
                this._cacheManager.add(this._getCacheKey(), this.supportedDisplayOptions);

                // Create menu items.
                this._setMenuItems(this.supportedDisplayOptions, selectedDisplayOption);
            }), lang.hitch(this, function (err) {
                // An error occured. Fallback to unfiltered/standard display options.
                this.supportedDisplayOptions = this.displayOptions;

                // Create menu items.
                this._setMenuItems(this.supportedDisplayOptions, selectedDisplayOption);
            }));
        },

        // Extracted from the original _setup method.
        _setMenuItems: function (displayOptions, selectedDisplayOption) {

            // Destroy the old menu items
            this._removeMenuItems();

            array.forEach(displayOptions, function (displayOption) {
                var item = new RadioMenuItem({
                    label: displayOption.name,
                    iconClass: displayOption.iconClass,
                    displayOptionId: displayOption.id,
                    checked: selectedDisplayOption === displayOption.id,
                    title: displayOption.description
                });

                this.own(item.watch("checked", lang.hitch(this, function (property, oldValue, newValue) {
                    if (!newValue) {
                        return;
                    }
                    // Modify the model
                    this.model.modify(function () {
                        this.model.set("displayOption", displayOption.id);
                    }, this);
                })));

                this.addChild(item);
            }, this);

            this._rdAutomatic.set("checked", !selectedDisplayOption);
        },

        // Adapted from EPiServer. No modifications.
        _removeMenuItems: function () {
            var items = this.getChildren();
            items.forEach(function (item) {
                if (item === this._rdAutomatic || item == this._separator) {
                    return;
                }
                this.removeChild(item);
                item.destroy();
            }, this);
        },

        // Custom method. Gets the global cache manager.
        _getCacheManager: function () {
            window.supportedDisplayOptionsCache = window.supportedDisplayOptionsCache || new CacheManager();
            return window.supportedDisplayOptionsCache;
        },

        // Custom method. Gets the supported display options cache key for current content.
        _getCacheKey: function() {
            return "SupportedDisplayOptions-" + this.model.contentLink;
        }
    });
});