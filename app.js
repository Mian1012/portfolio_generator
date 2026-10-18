/* PortfoGen — client-side demo. Configure Supabase through Database Setup. */
const SUPABASE_URL_KEY = "portfogen_supabase_url";
const SUPABASE_ANON_KEY = "portfogen_supabase_anon_key";
let supabaseClient = null;
let currentPortfolio = null;
let editId = null;
let toastTimer = null;
let selectedPhotoFile = null;
let photoPreviewObjectUrl = null;
const PHOTO_BUCKET = "profile-photos";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const pageMap = {home:"homePage", editor:"editorPage", templates:"templatesPage", preview:"previewPage", manage:"managePage"};
const templateNames = {simple:"Simple", modern:"Modern", creative:"Creative"};

function initSupabase() {
  const url = localStorage.getItem(SUPABASE_URL_KEY);
  const key = localStorage.getItem(SUPABASE_ANON_KEY);
  if (url && key && window.supabase) {
    try { supabaseClient = window.supabase.createClient(url, key); }
    catch (error) { console.error(error); supabaseClient = null; }
  }
}
function notify(message) {
  const toast = $("#toast");
  toast.textContent = message; toast.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}
function navigate(page) {
  if (!pageMap[page]) page = "home";
  $$(".page").forEach(el => el.classList.toggle("active", el.id === pageMap[page]));
  $$(".nav-link").forEach(el => el.classList.toggle("active", el.dataset.page === page));
  $(".main-nav").classList.remove("open");
  window.scrollTo({top:0,behavior:"smooth"});
  if (page === "manage") loadPortfolios();
  if (page === "templates") $("#templateShowcase")?.scrollIntoView({behavior:"smooth",block:"start"});
}
function splitLines(value) { return (value || "").split(/\n|,/).map(s=>s.trim()).filter(Boolean); }
const educationLevels = ["College", "Senior High School", "Junior High School", "Elementary School"];
function parseEducation(value) {
  if (Array.isArray(value)) return value;
  const raw = String(value || "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {}
  // Keep older portfolios readable: convert each legacy line into a basic entry.
  return raw.split(/\n/).map(line=>line.trim()).filter(Boolean).map(line=>({level:"",school:line,degree:"",startYear:"",endYear:""}));
}
function educationRow(entry={}) {
  const levelOptions = ['<option value="">Choose level</option>', ...educationLevels.map(level=>`<option value="${level}" ${entry.level===level?'selected':''}>${level}</option>`)].join("");
  return `<div class="education-entry-card"><div class="education-entry-top"><span class="education-entry-number">Education entry</span><button class="text-button remove-education" type="button">Remove</button></div><div class="education-entry-fields"><label class="field">Education level<select data-education="level">${levelOptions}</select></label><label class="field">School name<input data-education="school" maxlength="180" value="${escapeHtml(entry.school||"")}" placeholder="e.g. Cebu Eastern College"></label><label class="field field-wide">Degree / strand (optional)<input data-education="degree" maxlength="180" value="${escapeHtml(entry.degree||"")}" placeholder="e.g. Bachelor of Science in Information Technology"></label><label class="field">Start year<input data-education="startYear" inputmode="numeric" maxlength="4" value="${escapeHtml(entry.startYear||"")}" placeholder="2025"></label><label class="field">End year<input data-education="endYear" maxlength="9" value="${escapeHtml(entry.endYear||"")}" placeholder="Present or 2029"></label></div></div>`;
}
function readEducationRows() {
  return [...document.querySelectorAll(".education-entry-card")].map(card=>{
    const get=name=>card.querySelector(`[data-education="${name}"]`)?.value.trim()||"";
    return {level:get("level"),school:get("school"),degree:get("degree"),startYear:get("startYear"),endYear:get("endYear")};
  }).filter(entry=>entry.level||entry.school||entry.degree||entry.startYear||entry.endYear);
}
function syncEducationField() {
  const field = document.querySelector('#portfolioForm [name="education"]');
  if (field) field.value = JSON.stringify(readEducationRows());
}
function renderEducationEditor(value) {
  const wrap = document.getElementById("educationEntries");
  if (!wrap) return;
  const entries = parseEducation(value);
  wrap.innerHTML = (entries.length ? entries : [{level:"College",school:"",degree:"",startYear:"",endYear:""}]).map(educationRow).join("");
  wrap.querySelectorAll(".remove-education").forEach(btn=>btn.addEventListener("click",()=>{
    btn.closest(".education-entry-card").remove();
    if (!wrap.querySelector(".education-entry-card")) wrap.innerHTML = educationRow({});
    syncEducationField();
  }));
  wrap.querySelectorAll("input,select").forEach(field=>field.addEventListener("input",syncEducationField));
  syncEducationField();
}
function cleanPortfolio(raw) {
  const data = {...raw};
  data.full_name = (data.full_name || "").trim();
  data.template = templateNames[data.template] ? data.template : "simple";
  data.skills = Array.isArray(data.skills) ? data.skills.join(", ") : (data.skills || "");
  data.education = data.education || "";
  data.projects = data.projects || "";
  data.work_experience = data.work_experience || "";
  data.social_links = data.social_links || "";
  return data;
}
function formToObject(form) {
  syncEducationField();
  const fd = new FormData(form);
  const obj = Object.fromEntries(fd.entries());
  return cleanPortfolio(obj);
}
function fillForm(p) {
  const form = $("#portfolioForm");
  Object.keys(p).forEach(key => {
    const field = form.elements.namedItem(key);
    if (field && typeof field.value === "string") field.value = p[key] ?? "";
  });
  renderEducationEditor(p.education || "");
  clearSelectedPhoto();
  showPhotoPreview(p.profile_picture || "");
  const radio = form.querySelector(`input[name="template"][value="${p.template || "simple"}"]`);
  if (radio) radio.checked = true;
}
function safeUrl(value) {
  try { const url = new URL(value); return ["http:","https:"].includes(url.protocol) ? url.href : ""; }
  catch { return ""; }
}
function escapeHtml(value="") {
  return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function initials(name="Your Name") { return name.trim().split(/\s+/).slice(0,2).map(n=>n[0]||"").join("").toUpperCase() || "PG"; }
function photoMarkup(p, className="gp-photo") {
  const url = safeUrl(p.profile_picture || "");
  return url ? `<img class="${className}" src="${escapeHtml(url)}" alt="${escapeHtml(p.full_name)} profile picture" onerror="this.outerHTML='<div class=&quot;${className}&quot;>${escapeHtml(initials(p.full_name))}</div>'">`
    : `<div class="${className}" aria-label="Profile initials">${escapeHtml(initials(p.full_name))}</div>`;
}
function renderEntries(text, type) {
  const entries = splitLines(text);
  if (!entries.length) return `<div class="gp-item"><p>No ${type} added yet.</p></div>`;
  return entries.map(entry => {
    const match = entry.match(/https?:\/\/\S+/i);
    const url = match ? safeUrl(match[0].replace(/[),.;]+$/,"")) : "";
    const title = entry.replace(/https?:\/\/\S+/i,"").replace(/[—–-]\s*$/,"").trim() || (url ? "Visit link" : entry);
    return `<div class="gp-item"><b>${escapeHtml(title)}</b>${url ? `<p><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></p>` : ""}</div>`;
  }).join("");
}
function renderSocialLinks(text) {
  const entries = splitLines(text);
  if (!entries.length) return `<span class="gp-role">Add your links when editing your portfolio.</span>`;
  return entries.map(entry => {
    const match = entry.match(/https?:\/\/\S+/i);
    const url = match ? safeUrl(match[0]) : "";
    const label = entry.replace(/https?:\/\/\S+/i,"").replace(/[—–-]\s*$/,"").trim() || (url ? new URL(url).hostname : "Website");
    return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>` : `<span class="gp-role">${escapeHtml(label)}</span>`;
  }).join("");
}
function section(title, body, extra="") { return `<section class="gp-section ${extra}"><h3>${title}</h3>${body}</section>`; }
function renderPortfolio(p) {
  const data = cleanPortfolio(p || {});
  const skills = splitLines(data.skills);
  const role = data.work_experience ? splitLines(data.work_experience)[0] : "Portfolio / Personal Website";
  const name = escapeHtml(data.full_name || "Your Name");
  const contact = `${data.email ? `<span class="contact-email"><span class="contact-icon" aria-hidden="true">✉</span><span class="contact-value">${escapeHtml(data.email)}</span></span>` : ""}${data.contact_number ? `<span><span class="contact-icon" aria-hidden="true">☎</span><span class="contact-value">${escapeHtml(data.contact_number)}</span></span>` : ""}${data.address ? `<span><span class="contact-icon" aria-hidden="true">⌖</span><span class="contact-value">${escapeHtml(data.address)}</span></span>` : ""}`;
  const skillBody = `<div class="gp-skills">${(skills.length ? skills : ["Add your skills"]).map(s => `<span class="gp-skill">${escapeHtml(s)}</span>`).join("")}</div>`;
  const about = section("About me", `<p>${escapeHtml(data.about_me || "Add a short introduction about yourself, your interests, and what you want to create.")}</p>`);
  const educationItems = parseEducation(data.education);
  const educationMarkup = educationItems.length ? educationItems.map(item => {
    if (!item.level && !item.degree && !item.startYear && !item.endYear) return `<div class="gp-item"><b>${escapeHtml(item.school||"Education")}</b></div>`;
    const years = [item.startYear, item.endYear].filter(Boolean).join(" – ");
    return `<div class="gp-item education-portfolio-item"><div class="education-portfolio-top"><span class="education-level-label">${escapeHtml(item.level||"Education")}</span>${years ? `<span class="education-years">${escapeHtml(years)}</span>` : ""}</div><b>${escapeHtml(item.school||"School name")}</b>${item.degree ? `<p>${escapeHtml(item.degree)}</p>` : ""}</div>`;
  }).join("") : renderEntries(data.education,"education");
  const education = section("Education", `<div class="gp-list education-portfolio-list">${educationMarkup}</div>`);
  const projects = section("Selected projects", `<div class="gp-list">${renderEntries(data.projects,"projects")}</div>`);
  const experience = section("Experience", `<div class="gp-list">${renderEntries(data.work_experience,"experience")}</div>`);
  const links = section("Let's connect", `<div class="gp-links">${renderSocialLinks(data.social_links)}</div>`);
  const skillsSection = section("Skills", skillBody);
  const photo = photoMarkup(data);
  const contactBlock = `<div class="gp-contact">${contact || "<span>Available for opportunities</span>"}</div>`;
  const year = new Date().getFullYear();

  if (data.template === "modern") {
    return `<article class="generated-portfolio tpl-modern">
      <aside class="gp-sidebar">${photo}<h2 class="gp-name">${name}</h2><div class="gp-sidebar-label">PORTFOLIO / ${year}</div>${contactBlock}<div class="gp-side-note">DESIGNING WHAT'S NEXT <span>✳</span></div></aside>
      <main class="gp-main"><header class="gp-hero"><div class="gp-kicker">HELLO, I'M</div><h1 class="gp-name">${name}<span class="name-dot">.</span></h1><p class="gp-intro">${escapeHtml(data.about_me || "I build thoughtful digital experiences and turn ideas into useful things.")}</p><div class="gp-hero-tags"><span>CREATIVE THINKER</span><span>PROBLEM SOLVER</span><span>ALWAYS LEARNING</span></div></header>
      <div class="gp-content"><div class="gp-section-grid">${education}${experience}</div>${skillsSection}${projects}${links}</div></main></article>`;
  }
  if (data.template === "creative") {
    return `<article class="generated-portfolio tpl-creative"><header class="gp-hero"><div class="creative-spark spark-one">✳</div><div class="creative-spark spark-two">✦</div><div class="gp-kicker">A LITTLE DIFFERENT · ${year}</div><div class="creative-hero-row"><div class="creative-copy"><div class="creative-hello">Hello, I'm</div><h1 class="gp-name">${name}</h1><p class="creative-intro">${escapeHtml(data.about_me || "I turn ideas into clear, thoughtful, and memorable work.")}</p></div><div class="creative-portrait">${photo}<span class="portrait-star">✦</span></div></div><div class="creative-contact">${contact || "Open to new opportunities"}</div></header>
      <div class="gp-content"><div class="gp-section-grid">${education}${experience}</div>${skillsSection}${projects}${links}</div></article>`;
  }
  return `<article class="generated-portfolio tpl-simple"><aside class="gp-sidebar"><div class="simple-profile">${photo}<h1 class="gp-name">${name}</h1></div>${contactBlock}<div class="simple-sidebar-foot">PERSONAL PORTFOLIO · ${year}</div></aside><main class="gp-main"><header class="gp-hero"><div class="gp-kicker">A SNAPSHOT OF MY JOURNEY</div><h2>Thoughtful work.<br><span>Real-world impact.</span></h2></header><div class="gp-content"><div id="simple-about">${section("About me", `<p>${escapeHtml(data.about_me || "Add a short introduction about yourself, your interests, and what you want to create.")}</p>`)}</div><div class="gp-section-grid"><div id="simple-education">${education}</div><div id="simple-experience">${experience}</div></div><div id="simple-skills">${skillsSection}</div><div id="simple-projects">${projects}</div><div id="simple-contact">${links}</div></div></main></article>`;
}
function showPreview(p) {
  currentPortfolio = p;
  $("#portfolioOutput").innerHTML = renderPortfolio(p);
  navigate("preview");
}
function showPhotoPreview(url) {
  const wrap = $("#photoPreviewWrap"), img = $("#photoPreview");
  if (url) { img.src = url; wrap.hidden = false; }
  else { img.removeAttribute("src"); wrap.hidden = true; }
}
function clearSelectedPhoto() {
  selectedPhotoFile = null;
  $("#profilePhotoFile").value = "";
  if (photoPreviewObjectUrl) URL.revokeObjectURL(photoPreviewObjectUrl);
  photoPreviewObjectUrl = null;
  showPhotoPreview("");
}
async function uploadProfilePhoto(portfolioId) {
  if (!selectedPhotoFile) return $("#portfolioForm").elements.namedItem("profile_picture").value.trim();
  if (!supabaseClient) throw new Error("Connect Supabase before uploading a photo.");
  const ext = selectedPhotoFile.name.split(".").pop().toLowerCase();
  const path = `${portfolioId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabaseClient.storage.from(PHOTO_BUCKET).upload(path, selectedPhotoFile, {
    cacheControl: "3600", upsert: false, contentType: selectedPhotoFile.type
  });
  if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}. Check that the '${PHOTO_BUCKET}' bucket and its upload policy exist.`);
  const { data } = supabaseClient.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
async function savePortfolio(event) {
  event.preventDefault();
  const message = $("#formMessage");
  const saveBtn = $("#saveBtn");
  const data = formToObject($("#portfolioForm"));
  if (!data.full_name) { message.textContent = "Please enter your full name."; return; }
  if (!supabaseClient) {
    message.textContent = "Connect Supabase first. Your portfolio has not been saved online.";
    $("#configDialog").showModal(); return;
  }
  saveBtn.disabled = true; saveBtn.textContent = "Saving…"; message.textContent = "";
  try {
    let result;
    if (editId) {
      result = await supabaseClient.from("portfolios").update({...data,updated_at:new Date().toISOString()}).eq("id",editId).select().single();
    } else {
      result = await supabaseClient.from("portfolios").insert(data).select().single();
    }
    if (result.error) throw result.error;
    let saved = result.data;
    if (selectedPhotoFile) {
      message.textContent = "Uploading your profile photo…";
      const photoUrl = await uploadProfilePhoto(saved.id);
      const updateResult = await supabaseClient.from("portfolios").update({profile_picture:photoUrl,updated_at:new Date().toISOString()}).eq("id",saved.id).select().single();
      if (updateResult.error) throw updateResult.error;
      saved = updateResult.data;
      clearSelectedPhoto();
    }
    editId = saved.id;
    showPreview(saved);
    notify("Portfolio saved to Supabase.");
  } catch (err) {
    console.error(err); message.textContent = `Could not save: ${err.message || "Check your database setup and policies."}`;
  } finally {
    saveBtn.disabled = false; saveBtn.innerHTML = 'Save & preview <span>→</span>';
  }
}
async function loadPortfolios() {
  const list = $("#portfolioList"), status = $("#manageStatus");
  if (!supabaseClient) {
    status.textContent = "Supabase is not connected yet.";
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">✦</div><h3>Your portfolio space is ready.</h3><p>Connect your online database to save and manage portfolios.</p><button class="button button-primary" id="manageConnect">Connect Supabase</button></div>`;
    $("#manageConnect").addEventListener("click",()=>$("#configDialog").showModal());
    return;
  }
  status.textContent = "Loading saved portfolios…";
  list.innerHTML = "";
  try {
    const {data,error} = await supabaseClient.from("portfolios").select("*").order("created_at",{ascending:false});
    if (error) throw error;
    status.textContent = `${data.length} saved portfolio${data.length===1?"":"s"}`;
    if (!data.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">✦</div><h3>Every great portfolio starts somewhere.</h3><p>Create your first portfolio and it will appear here.</p><button class="button button-primary" data-page="editor">Create portfolio</button></div>`;
      return;
    }
    list.innerHTML = data.map(p=>`<article class="saved-card"><div class="saved-card-top">${photoMarkup(p)}<div><h3>${escapeHtml(p.full_name)}</h3><p>${escapeHtml(p.email || p.address || "Personal portfolio")}</p></div></div><span class="saved-tag">${escapeHtml(templateNames[p.template] ? templateNames[p.template] : p.template || "Simple")} template</span><div class="saved-actions"><button class="button button-primary" data-action="view" data-id="${escapeHtml(p.id)}">View</button><button class="button button-light" data-action="edit" data-id="${escapeHtml(p.id)}">Edit</button><button class="button button-light" data-action="delete" data-id="${escapeHtml(p.id)}">Delete</button></div></article>`).join("");
    list.querySelectorAll("[data-action]").forEach(btn=>btn.addEventListener("click",()=>handlePortfolioAction(btn.dataset.action,btn.dataset.id)));
  } catch (err) {
    console.error(err); status.textContent = "Could not load portfolios.";
    list.innerHTML = `<div class="empty-state"><h3>Database connection issue</h3><p>${escapeHtml(err.message || "Check your Supabase table and policies.")}</p><button class="button button-light" id="retryLoad">Try again</button></div>`;
    $("#retryLoad").addEventListener("click",loadPortfolios);
  }
}
async function handlePortfolioAction(action,id) {
  if (!supabaseClient) return;
  if (action === "delete" && !confirm("Delete this portfolio permanently? This cannot be undone.")) return;
  try {
    if (action === "delete") {
      const {error} = await supabaseClient.from("portfolios").delete().eq("id",id);
      if (error) throw error;
      if (editId === id) { editId = null; currentPortfolio = null; }
      notify("Portfolio deleted."); loadPortfolios(); return;
    }
    const {data,error} = await supabaseClient.from("portfolios").select("*").eq("id",id).single();
    if (error) throw error;
    if (action === "view") { editId = data.id; showPreview(data); }
    if (action === "edit") { editId = data.id; fillForm(data); navigate("editor"); $("#formMessage").textContent = "Editing saved portfolio. Save changes when finished."; }
  } catch(err) { notify(`Action failed: ${err.message || "Please try again."}`); }
}
function openConfig() {
  $("#supabaseUrl").value = localStorage.getItem(SUPABASE_URL_KEY) || "";
  $("#supabaseKey").value = localStorage.getItem(SUPABASE_ANON_KEY) || "";
  $("#configDialog").showModal();
}
function setupEvents() {
  document.addEventListener("click", e => {
    const nav = e.target.closest("[data-page]");
    if (nav) { e.preventDefault(); navigate(nav.dataset.page); }
    const useTemplate = e.target.closest("[data-use-template]");
    if (useTemplate) {
      $("#portfolioForm").elements.namedItem("template").value = useTemplate.dataset.useTemplate;
      const radio = $(`#portfolioForm input[name="template"][value="${useTemplate.dataset.useTemplate}"]`);
      if (radio) radio.checked = true;
      navigate("editor");
    }
  });
  $("#portfolioForm").addEventListener("submit",savePortfolio);
  $("#addEducationBtn").addEventListener("click",()=>{
    const wrap = $("#educationEntries");
    wrap.insertAdjacentHTML("beforeend",educationRow({}));
    const card = wrap.lastElementChild;
    card.querySelector(".remove-education").addEventListener("click",()=>{card.remove();if(!wrap.querySelector(".education-entry-card"))wrap.innerHTML=educationRow({});syncEducationField();});
    card.querySelectorAll("input,select").forEach(field=>field.addEventListener("input",syncEducationField));
    syncEducationField();
  });
  renderEducationEditor("[]");
  $("#choosePhotoBtn").addEventListener("click",()=>$("#profilePhotoFile").click());
  $("#profilePhotoFile").addEventListener("change",e=>{
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!["image/jpeg","image/png","image/webp"].includes(file.type)) {
      clearSelectedPhoto(); $("#formMessage").textContent = "Choose a PNG, JPG, or WEBP image."; return;
    }
    if (file.size > 2 * 1024 * 1024) {
      clearSelectedPhoto(); $("#formMessage").textContent = "Your image must be 2 MB or smaller."; return;
    }
    selectedPhotoFile = file;
    if (photoPreviewObjectUrl) URL.revokeObjectURL(photoPreviewObjectUrl);
    photoPreviewObjectUrl = URL.createObjectURL(file);
    showPhotoPreview(photoPreviewObjectUrl);
    $("#formMessage").textContent = "Photo selected. It will upload when you save the portfolio.";
  });
  $("#removePhotoBtn").addEventListener("click",()=>{
    clearSelectedPhoto();
    $("#portfolioForm").elements.namedItem("profile_picture").value = "";
    $("#formMessage").textContent = "Photo removed. Save to update your portfolio.";
  });
  $("#configBtn").addEventListener("click",openConfig);
  $("#setupFromEditor").addEventListener("click",openConfig);
  $("#cancelConfig").addEventListener("click",()=>$("#configDialog").close());
  $("#configForm").addEventListener("submit", async e=>{
    e.preventDefault();
    const url = $("#supabaseUrl").value.trim().replace(/\/+$/,"");
    const key = $("#supabaseKey").value.trim();
    const msg = $("#configMessage");
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) { msg.textContent = "Enter your Supabase project URL, like https://xxxx.supabase.co"; return; }
    if (!key) { msg.textContent = "Paste your publishable/anon key."; return; }
    localStorage.setItem(SUPABASE_URL_KEY,url); localStorage.setItem(SUPABASE_ANON_KEY,key);
    initSupabase();
    if (!supabaseClient) { msg.textContent = "Could not initialize Supabase. Check the URL and key."; return; }
    try {
      const {error} = await supabaseClient.from("portfolios").select("id").limit(1);
      if (error) throw error;
      msg.textContent = "Connected successfully!";
      setTimeout(()=>{ $("#configDialog").close(); notify("Supabase connected."); if ($("#managePage").classList.contains("active")) loadPortfolios(); },500);
    } catch(err) { msg.textContent = `Connection check failed: ${err.message}. Make sure you ran supabase-schema.sql.`; }
  });
  $("#editCurrentBtn").addEventListener("click",()=>{
    if (!currentPortfolio) return;
    fillForm(currentPortfolio); editId = currentPortfolio.id || editId; navigate("editor");
  });
  $("#printBtn").addEventListener("click",()=>window.print());
  $("#mobileMenu").addEventListener("click",()=>$(".main-nav").classList.toggle("open"));
}
document.addEventListener("DOMContentLoaded",()=>{
  initSupabase(); setupEvents();
  if (!supabaseClient) console.info("PortfoGen: connect Supabase using Database Setup.");
});
