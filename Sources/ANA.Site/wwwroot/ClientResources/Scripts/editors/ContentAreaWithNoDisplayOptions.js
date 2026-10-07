define([
        "dojo/_base/declare",
        "dojo/_base/lang",

	    "epi-cms/contentediting/command/BlockRemove",
	    "epi-cms/contentediting/command/BlockEdit",
	    "epi-cms/contentediting/command/MoveToPrevious",
	    "epi-cms/contentediting/command/MoveToNext",
	    "epi-cms/contentediting/command/MoveOutsideGroup",
	    "epi-cms/contentediting/command/Personalize",
	    "epi-cms/contentediting/command/SelectDisplayOption",

        "epi-cms/contentediting/editors/ContentAreaEditor"
    ],
    function(
        declare,
        lang,

        RemoveCommand,
        EditCommand,
        MoveToPrevious,
        MoveToNext,
        MoveOutsideGroup,
        Personalize,
        SelectDisplayOption,

        _ContentAreaEditor
    ) {
        return declare("app.editors.ContentAreaWithNoDisplayOptions", [_ContentAreaEditor], {
            postMixInProperties: function () {
                this._commands = [
                    new EditCommand(),
                   // new SelectDisplayOption(),
                    new Personalize({ category: null }),
                    new MoveOutsideGroup(),
                    new MoveToPrevious(),
                    new MoveToNext(),
                    new RemoveCommand()
                ];

                this.inherited(arguments);
            }
        });
});