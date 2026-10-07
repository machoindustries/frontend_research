# Font Assets

If you are providing web font files, this is the place to put them. The fonts task will copy them over to the destination specified in `config.json`.

If you don't plan using web fonts, or are relying on an external service like Google Fonts, feel free to delete this folder and the `tasks.fonts` config in `gulpfile.js/config.json`.

### Fonts.css

The CSS for your fonts should be placed in this file.

The included javascript package includes a font loader located in js/libs/fonts.js.  You will need to edit this file and update the `families` line to use your fonts.

### Tasks and Files
```
gulpfile.js/tasks/fonts
```
All this task does is copy them over to the destination specified in `config.json`. 