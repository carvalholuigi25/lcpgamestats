async function fetchTranslations(lang = "en") {
    try {
        const res = await fetch(`/json/langs/${lang}.json`);
        if (!res.ok) throw new Error(`Failed to load translations for ${lang}`);
        const data = await res.json();
        return data[lang] || data || {};
    } catch (err) {
        console.warn('Failed to load translations:', err.message);
        return {};
    }
}

function getVideoStuff(isEnabled = true, url = "https://stream.mux.com/BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM/highest.mp4", thumbnail = "https://image.mux.com/BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM/thumbnail.webp") {
    if (!isEnabled) return '';
    return document.querySelector('#video-container') && isEnabled ? `
    <video-player class="video-player" id="video-player" autoplay muted playsinline>
      <media-container class="media-default-skin media-default-skin--video">
        <video src="${url}"></video>

        <media-poster>
          <img src="${thumbnail}" alt="Thumbnail..." />
        </media-poster>

        <media-buffering-indicator class="media-buffering-indicator">
          <div class="media-surface">
            <media-icon name="spinner" class="media-icon"></media-icon>
          </div>
        </media-buffering-indicator>

        <media-error-dialog class="media-error">
          <div class="media-error__dialog media-surface">
            <div class="media-error__content">
              <media-alert-dialog-title class="media-error__title">Something went wrong.</media-alert-dialog-title>
              <media-alert-dialog-description class="media-error__description"></media-alert-dialog-description>
            </div>
            <div class="media-error__actions">
              <media-alert-dialog-close class="media-button media-button--primary">OK</media-alert-dialog-close>
            </div>
          </div>
        </media-error-dialog>

        <media-controls class="media-surface media-controls">
          <media-tooltip-group>
            <div class="media-button-group">
              <media-play-button commandfor="play-tooltip" class="media-button media-button--subtle media-button--icon media-button--play">
                <media-icon name="restart" class="media-icon media-icon--restart"></media-icon>
                <media-icon name="play" class="media-icon media-icon--play"></media-icon>
                <media-icon name="pause" class="media-icon media-icon--pause"></media-icon>
              </media-play-button>
              <media-tooltip id="play-tooltip" side="top" class="media-surface media-tooltip"></media-tooltip>

              <media-seek-button commandfor="seek-backward-tooltip" seconds="-10" class="media-button media-button--subtle media-button--icon media-button--seek">
                <span class="media-icon__container">
                  <media-icon name="seek" class="media-icon media-icon--flipped"></media-icon>
                  <span class="media-icon__label">10</span>
                </span>
              </media-seek-button>
              <media-tooltip id="seek-backward-tooltip" side="top" class="media-surface media-tooltip"></media-tooltip>

              <media-seek-button commandfor="seek-forward-tooltip" seconds="10" class="media-button media-button--subtle media-button--icon media-button--seek">
                <span class="media-icon__container">
                  <media-icon name="seek" class="media-icon"></media-icon>
                  <span class="media-icon__label">10</span>
                </span>
              </media-seek-button>
              <media-tooltip id="seek-forward-tooltip" side="top" class="media-surface media-tooltip"></media-tooltip>
            </div>

            <div class="media-time-controls">
              <media-time type="current" class="media-time"></media-time>
              <media-time-slider class="media-slider">
                <media-slider-track class="media-slider__track">
                  <media-slider-fill class="media-slider__fill"></media-slider-fill>
                  <media-slider-buffer class="media-slider__buffer"></media-slider-buffer>
                </media-slider-track>
                <media-slider-thumb class="media-slider__thumb"></media-slider-thumb>

                <div class="media-surface media-preview media-slider__preview">
                  <media-slider-thumbnail class="media-preview__thumbnail"></media-slider-thumbnail>
                  <media-slider-value type="pointer" class="media-time media-preview__time"></media-slider-value>
                  <media-icon name="spinner" class="media-preview__spinner media-icon"></media-icon>
                </div>
              </media-time-slider>
              <media-time type="duration" class="media-time"></media-time>
            </div>

            <div class="media-button-group">
              <media-playback-rate-menu-trigger commandfor="playback-rate-menu" class="media-button media-button--subtle media-button--icon media-button--playback-rate"></media-playback-rate-menu-trigger>
              <media-playback-rate-menu id="playback-rate-menu" side="top" align="center" class="media-surface media-popover media-menu media-menu--playback-rate">
                <media-playback-rate-options class="media-menu__group">
                  <template>
                    <media-menu-radio-item class="media-menu__item">
                      <span data-part="label"></span>
                      <media-menu-item-indicator force-mount class="media-menu__indicator">
                        <media-icon name="check" class="media-icon"></media-icon>
                      </media-menu-item-indicator>
                    </media-menu-radio-item>
                  </template>
                </media-playback-rate-options>
              </media-playback-rate-menu>

              <media-mute-button commandfor="video-volume-popover" class="media-button media-button--subtle media-button--icon media-button--mute">
                <media-icon name="volume-off" class="media-icon media-icon--volume-off"></media-icon>
                <media-icon name="volume-low" class="media-icon media-icon--volume-low"></media-icon>
                <media-icon name="volume-high" class="media-icon media-icon--volume-high"></media-icon>
              </media-mute-button>

              <media-popover id="video-volume-popover" open-on-hover delay="200" close-delay="100" side="top" class="media-surface media-popover media-popover--volume">
                <media-volume-slider class="media-slider" orientation="vertical" thumb-alignment="edge">
                  <media-slider-track class="media-slider__track">
                    <media-slider-fill class="media-slider__fill"></media-slider-fill>
                  </media-slider-track>
                  <media-slider-thumb class="media-slider__thumb media-slider__thumb--persistent"></media-slider-thumb>
                </media-volume-slider>
              </media-popover>

              <media-captions-button commandfor="captions-tooltip" class="media-button media-button--subtle media-button--icon media-button--captions">
                <media-icon name="captions-off" class="media-icon media-icon--captions-off"></media-icon>
                <media-icon name="captions-on" class="media-icon media-icon--captions-on"></media-icon>
              </media-captions-button>
              <media-tooltip id="captions-tooltip" side="top" class="media-surface media-tooltip"></media-tooltip>

              <media-cast-button commandfor="cast-tooltip" class="media-button media-button--subtle media-button--icon media-button--cast">
                <media-icon name="cast-enter" class="media-icon media-icon--cast-enter"></media-icon>
                <media-icon name="cast-exit" class="media-icon media-icon--cast-exit"></media-icon>
              </media-cast-button>
              <media-tooltip id="cast-tooltip" side="top" class="media-surface media-tooltip"></media-tooltip>

              <media-pip-button commandfor="pip-tooltip" class="media-button media-button--subtle media-button--icon media-button--pip">
                <media-icon name="pip-enter" class="media-icon media-icon--pip-enter"></media-icon>
                <media-icon name="pip-exit" class="media-icon media-icon--pip-exit"></media-icon>
              </media-pip-button>
              <media-tooltip id="pip-tooltip" side="top" class="media-surface media-tooltip"></media-tooltip>

              <media-fullscreen-button commandfor="fullscreen-tooltip" class="media-button media-button--subtle media-button--icon media-button--fullscreen">
                <media-icon name="fullscreen-enter" class="media-icon media-icon--fullscreen-enter"></media-icon>
                <media-icon name="fullscreen-exit" class="media-icon media-icon--fullscreen-exit"></media-icon>
              </media-fullscreen-button>
              <media-tooltip id="fullscreen-tooltip" side="top" class="media-surface media-tooltip"></media-tooltip>
            </div>
          </media-tooltip-group>
        </media-controls>

        <div class="media-overlay"></div>

        <!-- Hotkeys -->
        <media-hotkey keys="Space" action="togglePaused"></media-hotkey>
        <media-hotkey keys="k" action="togglePaused"></media-hotkey>
        <media-hotkey keys="m" action="toggleMuted"></media-hotkey>
        <media-hotkey keys="f" action="toggleFullscreen"></media-hotkey>
        <media-hotkey keys="c" action="toggleSubtitles"></media-hotkey>
        <media-hotkey keys="i" action="togglePictureInPicture"></media-hotkey>
        <media-hotkey keys="ArrowRight" action="seekStep" value="5"></media-hotkey>
        <media-hotkey keys="ArrowLeft" action="seekStep" value="-5"></media-hotkey>
        <media-hotkey keys="l" action="seekStep" value="10"></media-hotkey>
        <media-hotkey keys="j" action="seekStep" value="-10"></media-hotkey>
        <media-hotkey keys="ArrowUp" action="volumeStep" value="0.05"></media-hotkey>
        <media-hotkey keys="ArrowDown" action="volumeStep" value="-0.05"></media-hotkey>
        <media-hotkey keys="0-9" action="seekToPercent"></media-hotkey>
        <media-hotkey keys="Home" action="seekToPercent" value="0"></media-hotkey>
        <media-hotkey keys="End" action="seekToPercent" value="100"></media-hotkey>
        <media-hotkey keys=">" action="speedUp"></media-hotkey>
        <media-hotkey keys="<" action="speedDown"></media-hotkey>

        <!-- Gestures -->
        <media-gesture type="tap" action="togglePaused" pointer="mouse" region="center"></media-gesture>
        <media-gesture type="tap" action="toggleControls" pointer="touch"></media-gesture>
        <media-gesture type="doubletap" action="seekStep" value="-10" region="left"></media-gesture>
        <media-gesture type="doubletap" action="toggleFullscreen" region="center"></media-gesture>
        <media-gesture type="doubletap" action="seekStep" value="10" region="right"></media-gesture>

        <!-- Input Feedback -->
        <media-status-announcer></media-status-announcer>
        <div class="media-input-feedback">
          <media-volume-indicator hidden class="media-surface media-input-feedback-island media-input-feedback-island--volume">
            <media-volume-indicator-fill class="media-input-feedback-island__content">
              <media-icon name="volume-high" class="media-icon media-icon--volume-high"></media-icon>
              <media-icon name="volume-low" class="media-icon media-icon--volume-low"></media-icon>
              <media-icon name="volume-off" class="media-icon media-icon--volume-off"></media-icon>
              <media-volume-indicator-value class="media-input-feedback-island__value"></media-volume-indicator-value>
            </media-volume-indicator-fill>
          </media-volume-indicator>
          <media-status-indicator
            hidden
            actions="toggleSubtitles toggleFullscreen togglePictureInPicture"
            class="media-surface media-input-feedback-island media-input-feedback-island--status"
          >
            <div class="media-input-feedback-island__content">
              <media-icon name="captions-on" class="media-icon media-icon--captions-on"></media-icon>
              <media-icon name="captions-off" class="media-icon media-icon--captions-off"></media-icon>
              <media-icon name="fullscreen-enter" class="media-icon media-icon--fullscreen-enter"></media-icon>
              <media-icon name="fullscreen-exit" class="media-icon media-icon--fullscreen-exit"></media-icon>
              <media-icon name="pip-enter" class="media-icon media-icon--pip-enter"></media-icon>
              <media-icon name="pip-exit" class="media-icon media-icon--pip-exit"></media-icon>
              <media-status-indicator-value class="media-input-feedback-island__value"></media-status-indicator-value>
            </div>
          </media-status-indicator>
          <media-seek-indicator hidden class="media-input-feedback-bubble">
            <media-icon name="chevron" class="media-icon media-icon--seek"></media-icon>
            <media-seek-indicator-value class="media-time"></media-seek-indicator-value>
          </media-seek-indicator>
          <media-status-indicator hidden actions="togglePaused" class="media-input-feedback-bubble">
            <media-icon name="play" class="media-icon media-icon--play"></media-icon>
            <media-icon name="pause" class="media-icon media-icon--pause"></media-icon>
          </media-status-indicator>
        </div>
      </media-container>
    </video-player>` : '';
}

export { fetchTranslations, getVideoStuff };