// Mobile menu toggle
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('menuBtn');
  const menu = document.getElementById('mobileMenu');
  if (btn && menu){
    btn.addEventListener('click', () => {
      const open = menu.classList.toggle('flex');
      menu.classList.toggle('hidden');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      menu.classList.add('hidden');
      menu.classList.remove('flex');
      btn.setAttribute('aria-expanded', 'false');
    }));
  }

  // Scroll reveal
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window){
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting){
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  // Quad card cursor glow
  document.querySelectorAll('.quad-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--x', `${e.clientX - rect.left}px`);
      card.style.setProperty('--y', `${e.clientY - rect.top}px`);
    });
  });

  // Sticky nav shrink + background solidify on scroll
  const nav = document.getElementById('siteNav');
  if (nav){
    const onScroll = () => {
      if (window.scrollY > 24){ nav.classList.add('shadow-lg'); }
      else { nav.classList.remove('shadow-lg'); }
    };
    document.addEventListener('scroll', onScroll, { passive:true });
    onScroll();
  }

  // Year in footer
  document.querySelectorAll('.js-year').forEach(el => el.textContent = new Date().getFullYear());
});
