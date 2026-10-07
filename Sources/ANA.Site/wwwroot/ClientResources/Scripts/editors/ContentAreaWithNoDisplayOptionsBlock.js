define( [
   // General application modules
   "dojo/_base/declare",
   "dojo/_base/event",
   "dojo/_base/lang",
   "epi-cms/widget/overlay/Block",
   "epi-cms/contentediting/command/ContentAreaCommands"

], function (
   // General application modules
   declare,
   event,
   lang,
   Block,
   ContentAreaCommands
) {

    return declare([Block], {
        postCreate: function () {
            var contentAreaCommands = new ContentAreaCommands({ model: this.viewModel });
            contentAreaCommands.commands.splice(1, 1); // remove Display options menu
            this.commandProvider = contentAreaCommands;

            this.inherited(arguments);
        }

    });
});