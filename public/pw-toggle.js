/* Password show/hide toggle (eye icon)
   - Automatically enhances all input[type=password]
   - Works with RTL/LTR via logical CSS properties
*/
(function(){
  const EYE_OPEN = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c5.5 0 9.7 4.2 11 7-1.3 2.8-5.5 7-11 7S2.3 14.8 1 12c1.3-2.8 5.5-7 11-7Zm0 2C7.8 7 4.4 10.1 3.3 12 4.4 13.9 7.8 17 12 17s7.6-3.1 8.7-5C19.6 10.1 16.2 7 12 7Zm0 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/></svg>`;
  const EYE_CLOSED = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.3 3.7a1 1 0 0 1 1.4 0l17 17a1 1 0 1 1-1.4 1.4l-2.1-2.1C15.6 20 13.9 20.5 12 20.5c-5.5 0-9.7-4.2-11-7 .7-1.6 2.1-3.6 4.2-5.1L2.3 5.1a1 1 0 0 1 0-1.4ZM6.7 9.9C5 11.1 3.9 12.6 3.3 13.5 4.4 15.4 7.8 18.5 12 18.5c1.3 0 2.6-.3 3.7-.8l-1.7-1.7a4.5 4.5 0 0 1-5.6-5.6L6.7 9.9Zm5.3-6.4c5.5 0 9.7 4.2 11 7-.5 1.1-1.4 2.5-2.8 3.8a1 1 0 0 1-1.4-1.4c1.1-1 1.8-2 2.3-2.8-1.1-1.9-4.5-5-8.7-5-1 0-1.9.2-2.8.4a1 1 0 0 1-.5-2c1.1-.3 2.2-.5 3.4-.5Zm0 6a2.5 2.5 0 0 1 2.4 3.1 1 1 0 1 1-1.9-.6.5.5 0 1 0-.6.6 1 1 0 1 1-.6 1.9A2.5 2.5 0 0 1 12 9.5Z"/></svg>`;

  function makeToggle(input){
    if(!input || input.dataset.pwToggleReady === '1') return;
    input.dataset.pwToggleReady = '1';

    // Wrap input so we can position the button.
    const parent = input.parentElement;
    if(!parent) return;

    // If already wrapped, just ensure a button exists.
    if(parent.classList && parent.classList.contains('pw-field')){
      if(!parent.querySelector('.pw-toggle')) parent.appendChild(buildBtn(input));
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'pw-field';
    parent.insertBefore(wrap, input);
    wrap.appendChild(input);
    wrap.appendChild(buildBtn(input));
  }

  function buildBtn(input){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-toggle';
    btn.innerHTML = EYE_CLOSED;
    btn.setAttribute('aria-label', 'Show password');

    btn.addEventListener('click', function(){
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.innerHTML = isHidden ? EYE_OPEN : EYE_CLOSED;
      btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
      try{ input.focus({ preventScroll:true }); }catch(_){ input.focus(); }
    });

    // Keep button from submitting forms
    btn.addEventListener('mousedown', (e)=> e.preventDefault());

    return btn;
  }

  function setup(){
    const inputs = document.querySelectorAll('input[type="password"]');
    inputs.forEach(makeToggle);
  }

  // Initial
  document.addEventListener('DOMContentLoaded', setup);

  // In case forms/inputs are injected later.
  const obs = new MutationObserver(()=> setup());
  obs.observe(document.documentElement, { childList:true, subtree:true });
})();
