# Image Slider Library

A responsive, accessible image slider built with HTML, CSS, and vanilla JavaScript. It uses a horizontal transform track, dynamically generated indicator buttons, and cloned boundary slides to keep next and previous navigation moving in the same direction at the loop.

## Run the demo

Serve this folder over HTTP so the browser can load the JavaScript ES module. From this directory, run:

    python -m http.server 8000

Then open http://localhost:8000. The project has no build step or third-party JavaScript dependency. The sample photographs and web fonts load from their public image/font hosts.

## Features

- Previous and next buttons at the viewing window edges.
- One clickable indicator per supplied slide.
- Smooth horizontal translateX() movement.
- Direction-preserving wrap at both ends of the slide list.
- Responsive viewport and image sizing, with object-fit: cover.
- Left and right keyboard navigation while the slider has focus.
- Accessible names, active-dot state, slide status announcements, and reduced-motion support.
- A slidechange custom event for host-page integrations.
- Command queuing for repeated arrow input; a dot selection replaces pending commands and moves to the requested slide after the active transition.
- ResizeObserver-based track positioning.

## Markup contract

The slider root uses data-image-slider. It contains:

- A data-slider-viewport viewing window.
- A data-slider-track with one or more child elements marked data-slider-slide.
- Optional previous and next controls marked data-slider-previous and data-slider-next.
- A data-slider-dots container for generated indicators.
- Optional data-slider-current, data-slider-total, and data-slider-status display elements.

Each slide should include an image with meaningful alt text and can include a caption. The JavaScript clones the first and last slide at initialization to create seamless boundary transitions. Clones are removed when destroy() is called.

## Use the class

The ES module exports ImageSlider for page-specific setup:

    import { ImageSlider } from "./slider.js";

    const slider = new ImageSlider(document.querySelector("[data-image-slider]"));

Listen for changes with:

    document.querySelector("[data-image-slider]").addEventListener("slidechange", (event) => {
      console.log(event.detail.index, event.detail.source);
    });

Call slider.destroy() to remove listeners, clones, dots, and inline positioning.

## Image credits

Demo photographs are served by Unsplash's public image CDN. Unsplash permits use of its images under the Unsplash License; links to the individual image assets are listed in image-credits.md.
