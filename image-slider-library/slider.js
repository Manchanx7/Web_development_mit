const SLIDER_SELECTOR = "[data-image-slider]";

export class ImageSlider {
  constructor(root) {
    if (!(root instanceof HTMLElement)) {
      throw new TypeError("ImageSlider requires a slider root element.");
    }

    this.root = root;
    this.viewport = root.querySelector("[data-slider-viewport]");
    this.track = root.querySelector("[data-slider-track]");
    this.previousButton = root.querySelector("[data-slider-previous]");
    this.nextButton = root.querySelector("[data-slider-next]");
    this.dotsContainer = root.querySelector("[data-slider-dots]");
    this.status = root.querySelector("[data-slider-status]");
    this.currentLabel = root.querySelector("[data-slider-current]");
    this.totalLabel = root.querySelector("[data-slider-total]");
    this.originalSlides = this.track
      ? Array.from(this.track.children).filter((slide) => slide.matches("[data-slider-slide]"))
      : [];

    if (!this.viewport || !this.track || !this.dotsContainer || this.originalSlides.length === 0) {
      throw new Error("The slider needs a viewport, track, dot container, and at least one slide.");
    }

    this.slideCount = this.originalSlides.length;
    this.currentIndex = 0;
    this.visualIndex = this.slideCount > 1 ? 1 : 0;
    this.commandQueue = [];
    this.isAnimating = false;
    this.finishTimer = null;
    this.destroyed = false;
    this.boundPrevious = () => {
      this.enqueue({ type: "step", direction: -1, source: "previous" });
    };
    this.boundNext = () => {
      this.enqueue({ type: "step", direction: 1, source: "next" });
    };
    this.boundFinish = (event) => {
      if (event.target === this.track && event.propertyName === "transform") {
        this.finishAnimation();
      }
    };
    this.boundKeydown = (event) => this.handleKeydown(event);
    this.boundResize = () => this.setTrackPosition();

    this.buildLoopSlides();
    this.buildDots();
    this.bindEvents();
    this.updateControls();
    this.updateSlideAccessibility();
    this.updateTrackPositionWithoutAnimation();

    if ("ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(this.boundResize);
      this.resizeObserver.observe(this.viewport);
    } else {
      window.addEventListener("resize", this.boundResize, { passive: true });
    }
  }

  buildLoopSlides() {
    this.loopSlidesEnabled = this.slideCount > 1;
    this.clonedSlides = [];

    if (!this.loopSlidesEnabled) {
      return;
    }

    const firstClone = this.originalSlides[0].cloneNode(true);
    const lastClone = this.originalSlides[this.slideCount - 1].cloneNode(true);

    [firstClone, lastClone].forEach((clone) => {
      clone.removeAttribute("data-slider-slide");
      clone.setAttribute("aria-hidden", "true");
      clone.dataset.sliderClone = "true";
      clone.querySelectorAll("img").forEach((image) => {
        image.loading = "eager";
      });
      clone.querySelectorAll("a, button, input, select, textarea, [tabindex]").forEach((element) => {
        element.setAttribute("tabindex", "-1");
      });
    });

    this.track.prepend(lastClone);
    this.track.append(firstClone);
    this.clonedSlides = [lastClone, firstClone];
  }

  buildDots() {
    this.dotsContainer.replaceChildren();
    this.dots = this.originalSlides.map((slide, index) => {
      const button = document.createElement("button");
      const image = slide.querySelector("img");
      const description = image?.alt ? ": " + image.alt : "";

      button.type = "button";
      button.className = "slider-dot";
      button.dataset.sliderDot = String(index);
      button.setAttribute("aria-label", "Show image " + (index + 1) + " of " + this.slideCount + description);
      button.addEventListener("click", () => {
        this.enqueue({ type: "goTo", index, source: "dot" });
      });
      this.dotsContainer.append(button);
      return button;
    });
  }

  bindEvents() {
    this.previousButton?.addEventListener("click", this.boundPrevious);
    this.nextButton?.addEventListener("click", this.boundNext);
    this.root.addEventListener("keydown", this.boundKeydown);
    this.track.addEventListener("transitionend", this.boundFinish);
  }

  handleKeydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      this.enqueue({ type: "step", direction: -1, source: "keyboard" });
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      this.enqueue({ type: "step", direction: 1, source: "keyboard" });
    }
  }

  enqueue(command) {
    if (this.destroyed || !this.loopSlidesEnabled) {
      return;
    }

    if (command.type === "goTo") {
      this.commandQueue = [command];
    } else {
      this.commandQueue.push(command);
    }

    this.processQueue();
  }

  processQueue() {
    if (this.isAnimating || this.commandQueue.length === 0 || this.destroyed) {
      return;
    }

    const command = this.commandQueue.shift();
    const targetIndex =
      command.type === "step"
        ? (this.currentIndex + command.direction + this.slideCount) % this.slideCount
        : command.index;

    if (targetIndex === this.currentIndex) {
      this.processQueue();
      return;
    }

    let targetVisualIndex = targetIndex + 1;
    const movingForward =
      command.type === "step"
        ? command.direction > 0
        : this.currentIndex === this.slideCount - 1 && targetIndex === 0;
    const movingBackward =
      command.type === "step"
        ? command.direction < 0
        : this.currentIndex === 0 && targetIndex === this.slideCount - 1;

    if (movingForward && this.currentIndex === this.slideCount - 1 && targetIndex === 0) {
      targetVisualIndex = this.slideCount + 1;
    } else if (movingBackward && this.currentIndex === 0 && targetIndex === this.slideCount - 1) {
      targetVisualIndex = 0;
    }

    this.animateTo(targetIndex, targetVisualIndex, command.source);
  }

  animateTo(targetIndex, targetVisualIndex, source) {
    this.currentIndex = targetIndex;
    this.visualIndex = targetVisualIndex;
    this.isAnimating = true;
    this.updateControls();
    this.updateSlideAccessibility();
    this.setTrackPosition();

    const activeSlide = this.originalSlides[targetIndex];
    this.root.dispatchEvent(
      new CustomEvent("slidechange", {
        bubbles: true,
        detail: { index: targetIndex, slide: activeSlide, source },
      }),
    );

    const duration = this.getTransitionDuration();
    if (duration <= 1) {
      this.finishTimer = window.setTimeout(() => this.finishAnimation(), 20);
    } else {
      this.finishTimer = window.setTimeout(() => this.finishAnimation(), duration + 100);
    }
  }

  finishAnimation() {
    if (!this.isAnimating || this.destroyed) {
      return;
    }

    window.clearTimeout(this.finishTimer);
    this.finishTimer = null;

    const wrappedAtEnd = this.visualIndex === this.slideCount + 1;
    const wrappedAtStart = this.visualIndex === 0;
    if (wrappedAtEnd || wrappedAtStart) {
      this.visualIndex = wrappedAtEnd ? 1 : this.slideCount;
      this.track.style.transition = "none";
      this.setTrackPosition();
      this.track.offsetWidth;
      this.track.style.removeProperty("transition");
    }

    this.isAnimating = false;
    this.processQueue();
  }

  updateControls() {
    const hasMultipleSlides = this.slideCount > 1;
    if (this.previousButton) {
      this.previousButton.disabled = !hasMultipleSlides;
    }
    if (this.nextButton) {
      this.nextButton.disabled = !hasMultipleSlides;
    }

    this.dots.forEach((dot, index) => {
      const isActive = index === this.currentIndex;
      dot.classList.toggle("is-active", isActive);
      if (isActive) {
        dot.setAttribute("aria-current", "true");
      } else {
        dot.removeAttribute("aria-current");
      }
    });

    if (this.currentLabel) {
      this.currentLabel.textContent = String(this.currentIndex + 1).padStart(2, "0");
    }
    if (this.totalLabel) {
      this.totalLabel.textContent = String(this.slideCount).padStart(2, "0");
    }
    if (this.status) {
      const image = this.originalSlides[this.currentIndex].querySelector("img");
      const label = image?.alt || "Image " + (this.currentIndex + 1);
      this.status.textContent =
        "Image " + (this.currentIndex + 1) + " of " + this.slideCount + ". " + label;
    }
  }

  updateSlideAccessibility() {
    this.originalSlides.forEach((slide, index) => {
      slide.setAttribute("aria-hidden", String(index !== this.currentIndex));
    });
  }

  setTrackPosition() {
    const width = this.viewport.getBoundingClientRect().width;
    this.track.style.transform = "translateX(" + -this.visualIndex * width + "px)";
  }

  updateTrackPositionWithoutAnimation() {
    this.track.style.transition = "none";
    this.setTrackPosition();
    this.track.offsetWidth;
    this.track.style.removeProperty("transition");
    this.updateControls();
  }

  getTransitionDuration() {
    const durations = getComputedStyle(this.track).transitionDuration.split(",");
    const delays = getComputedStyle(this.track).transitionDelay.split(",");
    const toMilliseconds = (value) => {
      const trimmed = value.trim();
      return trimmed.endsWith("ms")
        ? Number.parseFloat(trimmed)
        : Number.parseFloat(trimmed) * 1000;
    };

    return Math.max(
      0,
      ...durations.map((duration, index) => {
        const delay = delays[index % delays.length] || "0s";
        return toMilliseconds(duration) + toMilliseconds(delay);
      }),
    );
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    window.clearTimeout(this.finishTimer);
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.boundResize);
    this.previousButton?.removeEventListener("click", this.boundPrevious);
    this.nextButton?.removeEventListener("click", this.boundNext);
    this.root.removeEventListener("keydown", this.boundKeydown);
    this.track.removeEventListener("transitionend", this.boundFinish);
    this.clonedSlides.forEach((slide) => slide.remove());
    this.dotsContainer.replaceChildren();
    this.track.style.removeProperty("transform");
    this.track.style.removeProperty("transition");
  }
}

const sliders = Array.from(document.querySelectorAll(SLIDER_SELECTOR)).map((root) => {
  try {
    return new ImageSlider(root);
  } catch (error) {
    console.error("Unable to initialize image slider:", error);
    return null;
  }
});

export default sliders;
