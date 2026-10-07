define( [
   // Dojo
   "dojo/_base/array",
   "dojo/_base/declare",
   "dojo/_base/lang",

   "./ContentAreaWithNoDisplayOptionsBlock",

   "epi-cms/widget/overlay/ContentArea"
], function (
   // Dojo
   array,
   declare,
   lang,
   CustomBlock,
   ContentArea
) {
    return declare([ContentArea], {
        blockClass: CustomBlock
    });
});