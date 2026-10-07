# Icon Assets

Drop SVG files here to automatically compile and recompile an SVG sprite containing all your icons.  If you aren't going to use this, **be sure to disable or remove the config for the method you're not using** in `gulpfile.js/config.json`.

If you don't plan using SVG sprites, you may delete this folder and the associated task config in `gulpfile.js/config.json`.

## Tasks and Files
### SVG Sprite Task
```
gulpfile.js/tasks/svgSprite
```

Generates an SVG Sprite! You can reference the icon by id like this:

```html
  <svg role="img" title="alt text"><use xlink:href='#my-icon' /></svg>
```

I've included a Panini helper to generate the required svg markup in `panini/helpers/svgSprite.js`, so you can just do:
```html
  {{{svgSprite 'my-icon' 'alt text'}}}
```
Which spits out:

```html
  <span class='sprite -my-icon'>
    <svg role="img" title="alt text"><use xlink:href='#my-icon' /></svg>
  </span>
```

This particular setup allows styling 2 different colors from your css. You can have unlimited colors hard coded into your svg.

In the following example, the first path will be `red`, the second will be `white`, and the third will be `blue`. Paths **without a fill attribute** will inherit the `fill` property from css. Paths with **fill="currentColor"** will inherit the current css `color` value, and hard-coded fills will not be overwritten, since inline styles trump css values.

```sass
.sprite
  fill: red
  color: white
```

```svg
  <svg xmlns="http://www.w3.org/2000/svg">
    <path d="..."/>
    <path fill="currentColor" d="..."/>
    <path fill="blue" d="..."/>
  </svg>
```

I recommend setting up your SVGs on a 500 x 500 canvas, centering your artwork, and expanding/combining any shapes of the same color. This last step is important. [Read more on SVG optimization here!](https://www.viget.com/articles/5-tips-for-saving-svg-for-the-web-with-illustrator)