// script.js
// Full site JS: year, smooth scroll, active nav, carousels, and lightbox.
// Put this file in your project and include <script src="script.js"></script> at the bottom of the page.

document.addEventListener('DOMContentLoaded', () => {

  /* -------------------- YEAR -------------------- */
  (function setYear(){
    const y = new Date().getFullYear();
    const el1 = document.getElementById('year');
    if(el1) el1.textContent = y;
    const el2 = document.getElementById('year3');
    if(el2) el2.textContent = y;
  })();


  /* -------------------- SMOOTH SCROLL --------------------
     Works for:
     - same-page anchors: href="#projects"
     - links to same-site pages with hash: href="index.html#projects"
     For other links (external or different page) default behavior is preserved.
  */
  (function bindSmoothScroll(){
    document.querySelectorAll('a[href*="#"]').forEach(a => {
      // ignore empty href like "#" only if you want
      a.addEventListener('click', (ev) => {
        const href = a.getAttribute('href');
        if(!href) return;
        // get hash and path
        const hashIndex = href.indexOf('#');
        if(hashIndex === -1) return; // no hash
        const hash = href.slice(hashIndex);
        const path = href.slice(0, hashIndex); // may be '' or 'index.html' or similar

        // normalize path (strip query / origin) and current page
        const currentPath = window.location.pathname.split('/').pop(); // e.g., index.html or ''
        const targetPath = path.split('/').pop();

        // If link is same-page (path empty) OR path equals currentPath, do smooth scroll
        if(path === '' || path === '.' || targetPath === currentPath || (targetPath === '' && currentPath === '')) {
          // find the element by the hash (without #)
          const id = hash.slice(1);
          const target = document.getElementById(id);
          if(target){
            ev.preventDefault();
            target.scrollIntoView({behavior: 'smooth', block: 'start'});
            // update URL hash without jumping/causing immediate scroll
            history.replaceState(null, '', hash);
          }
        }
        // otherwise allow normal navigation to other page (e.g., index.html#projects)
      });
    });
  })();


  /* -------------------- ACTIVE LINK ON SCROLL --------------------
     Uses IntersectionObserver; safe when some sections are absent.
  */
  (function activateOnScroll(){
    const links = Array.from(document.querySelectorAll('.nav-link')).filter(l => {
      const href = l.getAttribute('href') || '';
      return href.includes('#');
    });

    if(links.length === 0) return;

    // map to section elements if present
    const sections = links.map(l => {
      const href = l.getAttribute('href') || '';
      const hashIndex = href.indexOf('#');
      if(hashIndex === -1) return null;
      const id = href.slice(hashIndex + 1);
      return document.getElementById(id);
    });

    const observed = sections.filter(Boolean);
    if(observed.length === 0) return;

    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          const id = entry.target.id;
          links.forEach(l => {
            const href = l.getAttribute('href') || '';
            l.classList.toggle('active', href.includes(`#${id}`));
          });
        }
      });
    }, {threshold: 0.55});

    observed.forEach(s => obs.observe(s));
  })();


  /* -------------------- CAROUSELS (multi-instance) --------------------
     Works with elements that match:
       .project-carousel  (small preview inside project cards)
       .project-page-hero (large viewer on project pages)
  */
  (function initCarousels(){
    const carousels = Array.from(document.querySelectorAll('.project-carousel, .project-page-hero'));
    if(carousels.length === 0) return;

    carousels.forEach((carousel) => {
      const track = carousel.querySelector('.carousel-track');
      if(!track) return;
      const slides = Array.from(track.children);
      if(slides.length === 0) return;

      let index = 0;

      // ensure initial transform
      function update() {
        track.style.transform = `translateX(-${index * 100}%)`;
      }

      // prev/next buttons
      const prevBtn = carousel.querySelector('.prev');
      const nextBtn = carousel.querySelector('.next');

      if(prevBtn) prevBtn.addEventListener('click', () => {
        index = (index - 1 + slides.length) % slides.length;
        update();
      });

      if(nextBtn) nextBtn.addEventListener('click', () => {
        index = (index + 1) % slides.length;
        update();
      });

      // touch swipe
      let startX = 0, deltaX = 0;
      const windowEl = carousel.querySelector('.carousel-window');
      if(windowEl){
        windowEl.addEventListener('touchstart', e => {
          startX = e.touches[0].clientX;
        }, {passive:true});
        windowEl.addEventListener('touchmove', e => {
          deltaX = e.touches[0].clientX - startX;
        }, {passive:true});
        windowEl.addEventListener('touchend', () => {
          if(Math.abs(deltaX) > 40){
            if(deltaX < 0) index = (index + 1) % slides.length;
            else index = (index - 1 + slides.length) % slides.length;
            update();
          }
          startX = 0; deltaX = 0;
        });
      }

      // keyboard support when focused
      carousel.tabIndex = 0;
      carousel.addEventListener('keydown', (e) => {
        if(e.key === 'ArrowLeft'){
          index = (index - 1 + slides.length) % slides.length;
          update();
        } else if(e.key === 'ArrowRight'){
          index = (index + 1) % slides.length;
          update();
        }
      });

      // set initial
      update();
    });
  })();


  /* -------------------- LIGHTBOX --------------------
     Fullscreen modal gallery that opens when clicking any carousel image.
     Supports:
       - data-large attribute as high-res src fallback
       - click outside to close, Esc to close
       - prev/next buttons, keyboard arrows
       - swipe on touch
  */
  (function initLightbox(){

    // create overlay once
    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="lightbox-inner" role="dialog" aria-modal="true">
        <button class="lightbox-close" aria-label="Close">✕</button>
        <button class="lightbox-prev" aria-label="Previous">‹</button>
        <img class="lightbox-img" src="" alt="">
        <button class="lightbox-next" aria-label="Next">›</button>
        <div class="lightbox-caption" style="display:none"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    const inner = overlay.querySelector('.lightbox-inner');
    const imgEl = overlay.querySelector('.lightbox-img');
    const closeBtn = overlay.querySelector('.lightbox-close');
    const prevBtn = overlay.querySelector('.lightbox-prev');
    const nextBtn = overlay.querySelector('.lightbox-next');
    const captionEl = overlay.querySelector('.lightbox-caption');

    let currentGallery = [];
    let currentIndex = 0;
    let lastActiveElement = null;

    function openLightbox(gallery, startIndex = 0){
      if(!Array.isArray(gallery) || gallery.length === 0) return;
      currentGallery = gallery;
      currentIndex = Math.max(0, Math.min(startIndex, gallery.length - 1));
      showImage();
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      lastActiveElement = document.activeElement;
      // prevent page from scrolling
      document.documentElement.classList.add('lightbox-open');
      document.body.style.overflow = 'hidden';
      // focus close button for accessibility
      closeBtn.focus();
    }

    function closeLightbox(){
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('lightbox-open');
      document.body.style.overflow = '';
      // return focus to last element if available
      if(lastActiveElement && typeof lastActiveElement.focus === 'function') {
        lastActiveElement.focus();
      }
    }

    function showImage(){
      const item = currentGallery[currentIndex];
      if(!item) return;
      imgEl.src = item.src;
      imgEl.alt = item.alt || '';
      if(item.caption){
        captionEl.textContent = item.caption;
        captionEl.style.display = 'block';
      } else {
        captionEl.style.display = 'none';
      }
    }

    function goNext(){
      if(currentGallery.length === 0) return;
      currentIndex = (currentIndex + 1) % currentGallery.length;
      showImage();
    }

    function goPrev(){
      if(currentGallery.length === 0) return;
      currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length;
      showImage();
    }

    // Event bindings
    closeBtn.addEventListener('click', closeLightbox);
    nextBtn.addEventListener('click', goNext);
    prevBtn.addEventListener('click', goPrev);

    // click overlay outside inner to close
    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) closeLightbox();
    });

    // keyboard handling
    document.addEventListener('keydown', (e) => {
      if(!overlay.classList.contains('active')) return;
      if(e.key === 'Escape') closeLightbox();
      if(e.key === 'ArrowRight') goNext();
      if(e.key === 'ArrowLeft') goPrev();
    });

    // swipe support for the image
    (function addSwipe(){
      let sx = 0, dx = 0;
      imgEl.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, {passive:true});
      imgEl.addEventListener('touchmove', e => { dx = e.touches[0].clientX - sx; }, {passive:true});
      imgEl.addEventListener('touchend', () => {
        if(Math.abs(dx) > 40){
          if(dx < 0) goNext(); else goPrev();
        }
        sx = 0; dx = 0;
      });
    })();

    // Attach click handlers to carousel images
    // For each carousel (preview or large page), build a gallery array from its slides.
    const carouselWrappers = Array.from(document.querySelectorAll('.project-carousel, .project-page-hero'));
    carouselWrappers.forEach(wrapper => {
      const track = wrapper.querySelector('.carousel-track');
      if(!track) return;
      const imgs = Array.from(track.querySelectorAll('.slide img'));
      if(imgs.length === 0) return;

      // create gallery items; prefer data-large, fallback to src
      const gallery = imgs.map(img => ({
        src: img.dataset.large || img.src,
        alt: img.alt || '',
        caption: img.dataset.caption || ''
      }));

      imgs.forEach((img, idx) => {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', (e) => {
          e.preventDefault();
          openLightbox(gallery, idx);
        });
      });
    });

  })(); // initLightbox

}); // DOMContentLoaded
