// gsap scroll trigger
gsap.registerPlugin(ScrollTrigger);

// Fetch event data from JSON
fetch('events.json')
    .then(response => response.json())
    .then(events => {
        const timeline = document.getElementById('timeline');

        // Dynamically create event elements
        events.forEach((event, index) => {
            const eventDiv = document.createElement('div');
            eventDiv.className = `event ${index % 2 === 0 ? 'event-top' : 'event-bottom'}`;

            eventDiv.innerHTML = `
            <a href="${event.link}" style="color:white;">
              <img src="${event.image}" alt="${event.title}">
            </a>
            <div class="event-content">
              <h3 class="event-title">${event.title}</h3>
              <p class="event-date">${event.date}</p>
              <p class="event-description">${event.description}</p>
            </div>
          `;

            timeline.appendChild(eventDiv);
        });

        // Initialize GSAP after events are added
        initializeScrollTrigger();
    })
    .catch(error => console.error('Error loading events:', error));

function initializeScrollTrigger() {
    const timeline = document.querySelector('.timeline');
    const wrapper = document.querySelector('.timeline-scroll-section');
    const container = document.querySelector('.timeline-container');

    if (!timeline || !wrapper || !container) {
        console.warn('Timeline elements not found');
        return;
    }

    // Total horizontal distance the timeline needs to travel
    const scrollWidth = timeline.scrollWidth - window.innerWidth;

    // Set wrapper height so we have enough vertical scroll space
    // to scrub through the entire horizontal distance
    wrapper.style.height = (scrollWidth + window.innerHeight) + 'px';

    gsap.to(timeline, {
        x: () => -(timeline.scrollWidth - window.innerWidth) + "px",
        ease: "none",
        scrollTrigger: {
            trigger: wrapper,
            start: "top top",
            end: () => "+=" + scrollWidth,
            scrub: true,
            // NOTE: no pin here — the container is sticky in CSS,
            // so ScrollTrigger only drives x translation and does not
            // steal scroll from the rest of the page.
        },
    });
}
