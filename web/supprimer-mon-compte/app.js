// Suppression à distance (§6.6) : code e-mail Supabase (sans création de compte), puis
// appel de l'Edge Function delete-account avec le jeton obtenu, frais de moins de 5 minutes.
(() => {
  'use strict';
  const config = document.body.dataset;
  const url = config.supabaseUrl, key = config.publishableKey;
  const status = document.getElementById('status');
  const emailForm = document.getElementById('step-email'), codeForm = document.getElementById('step-code');
  const support = document.getElementById('support-link');
  support.href = 'mailto:' + config.supportEmail + '?subject=' + encodeURIComponent('Suppression de mon compte Sprinter');
  support.textContent = config.supportEmail;
  let email = '';
  const say = (text) => { status.textContent = text; };
  const busy = (form, value) => form.querySelectorAll('button, input').forEach((el) => { el.disabled = value; });
  const post = (path, body, token) => fetch(url + path, {
    method: 'POST',
    headers: Object.assign({ apikey: key, 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body),
  });
  async function follow(operation) {
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        const response = await fetch(url + '/functions/v1/delete-account?operation=' + encodeURIComponent(operation), { headers: { apikey: key } });
        const result = await response.json();
        if (result.status === 'done') { say('Votre compte et vos données en ligne ont été supprimés.'); return; }
      } catch (error) { /* nouvel essai */ }
    }
    say('Votre demande est validée et vos accès sont retirés. Le nettoyage se termine automatiquement.');
  }
  emailForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    email = emailForm.email.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { say('Saisissez une adresse e-mail valide.'); return; }
    busy(emailForm, true); say('Envoi du code…');
    try {
      const response = await post('/auth/v1/otp', { email, create_user: false });
      // Même message que le compte existe ou non : la page ne révèle pas les adresses inscrites.
      if (response.status === 429) { say('Trop de demandes. Patientez une minute avant de réessayer.'); busy(emailForm, false); return; }
      say('Si un compte Sprinter utilise cette adresse, un code vient de lui être envoyé.');
      emailForm.hidden = true; codeForm.hidden = false; codeForm.code.focus();
    } catch (error) { say('Service indisponible. Réessayez plus tard.'); busy(emailForm, false); }
  });
  codeForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = codeForm.code.value.trim();
    if (!/^\d{6}$/.test(code)) { say('Le code comporte 6 chiffres.'); return; }
    if (codeForm.confirm.value.trim() !== 'SUPPRIMER') { say('Saisissez SUPPRIMER pour confirmer.'); return; }
    busy(codeForm, true); say('Vérification du code…');
    try {
      const verify = await post('/auth/v1/verify', { type: 'email', email, token: code });
      const session = await verify.json();
      if (!verify.ok || !session.access_token) { say('Code incorrect ou expiré.'); busy(codeForm, false); return; }
      say('Suppression en cours…');
      const response = await post('/functions/v1/delete-account', { source: 'web' }, session.access_token);
      const result = await response.json();
      if (response.status === 200) say('Votre compte et vos données en ligne ont été supprimés.');
      else if (response.status === 202) { say('Suppression validée. Finalisation en cours…'); follow(result.operation_id); }
      else { say('La suppression n’a pas pu être validée. Réessayez ou contactez le support.'); busy(codeForm, false); }
    } catch (error) { say('Service indisponible. Réessayez plus tard.'); busy(codeForm, false); }
  });
})();
