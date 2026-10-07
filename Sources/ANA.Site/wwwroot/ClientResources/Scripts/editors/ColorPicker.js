define([
        "dojo/_base/declare",
        "dijit/ColorPalette",
        "dijit/form/Button"
],
function(declare, ColorPalette, Button) {
    return declare("alloy.editors.ColorPalette", [ColorPalette], {
        templateString: '<div class="dijitInline dijitColorPalette" role="grid"> ' +
            '<table dojoAttachPoint="paletteTableNode" class="dijitPaletteTable" cellSpacing="0" cellPadding="0" role="presentation"> ' +
            '<tbody data-dojo-attach-point="gridNode"></tbody> ' +
            '</table>' +
            '<div data-dojo-attach-point="aButton" data-dojo-props="iconClass:\'dijitEditorIcon dijitEditorIconCut\', showLabel: false"></div>' +
            '</div>',

        widgetsInTemplate: true,

        postCreate: function () {
            var obj = this;
            this.button = new Button({
                label: "Reset",
                onClick: function() {
                    obj.set('value', null);
                }
            }).placeAt(this.aButton);
        }
    });
});