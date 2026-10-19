(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const config = window.JERSEY_CE_CONFIG || {};
  const configured = config.supabaseUrl && config.supabaseAnonKey &&
    !config.supabaseUrl.includes("PASTE_") && !config.supabaseAnonKey.includes("PASTE_");
  const supabase = configured && window.supabase
    ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
    : null;

  let session = null, products = [], cart = [], category = "All", search = "", authMode = "signin";
  const demoProducts = [
    {id:"demo-1",name:"Core Logo Tee",category:"T-Shirts",price:799,compare_at:999,description:"Heavyweight everyday cotton tee.",image_url:"",active:true},
    {id:"demo-2",name:"Essential Hoodie",category:"Hoodies",price:1499,compare_at:1899,description:"Relaxed-fit fleece hoodie.",image_url:"",active:true},
    {id:"demo-3",name:"Club Jersey",category:"Jerseys",price:1199,compare_at:1499,description:"Sport-inspired street jersey.",image_url:"",active:true},
    {id:"demo-4",name:"Boxy Fit Tee",category:"T-Shirts",price:899,compare_at:1099,description:"Boxy silhouette, clean finish.",image_url:"",active:true},
    {id:"demo-5",name:"Daily Cap",category:"Accessories",price:499,compare_at:599,description:"Adjustable everyday cap.",image_url:"",active:true},
    {id:"demo-6",name:"Track Hoodie",category:"Hoodies",price:1599,compare_at:1999,description:"A warm layer for cooler days.",image_url:"",active:true},
    {id:"demo-7",name:"Number 07 Jersey",category:"Jerseys",price:1299,compare_at:1599,description:"Classic sportswear-inspired jersey.",image_url:"",active:true},
    {id:"demo-8",name:"Logo Tote",category:"Accessories",price:399,compare_at:499,description:"Simple carry-all tote bag.",image_url:"",active:true}
  ];

  const money = (n) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(n)||0);
  const safe = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let toastTimer;
  function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);}
  function openPanel(id){closePanels();$("#"+id).classList.add("open");$("#"+id).setAttribute("aria-hidden","false");$("#overlay").classList.add("visible");}
  function closePanels(){$$(".drawer,.customizer,.modal").forEach(el=>{el.classList.remove("open");el.setAttribute("aria-hidden","true")});$("#overlay").classList.remove("visible");}
  function persistGuestCart(){try{localStorage.setItem("jersey-ce-guest-cart",JSON.stringify(cart));}catch{}}
  function readGuestCart(){try{return JSON.parse(localStorage.getItem("jersey-ce-guest-cart")||"[]");}catch{return [];}}
  function cartCount(){return cart.reduce((sum,item)=>sum+item.quantity,0);}
  function renderCart(){ $("#cartCount").textContent=cartCount();$("#cartSubtotal").textContent=money(cart.reduce((sum,item)=>sum+item.price*item.quantity,0));
    $("#cartItems").innerHTML=cart.length?cart.map(item=>`<div class="cart-row"><div class="cart-thumb">${item.image_url?`<img src="${safe(item.image_url)}" alt="" style="width:100%;height:100%;object-fit:cover">`:"JC"}</div><div><h3>${safe(item.name)}</h3><p>${money(item.price)}</p><div class="quantity-controls"><button data-qty="${safe(item.id)}" data-delta="-1" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button data-qty="${safe(item.id)}" data-delta="1" aria-label="Increase quantity">+</button></div><button class="remove-item" data-remove="${safe(item.id)}">Remove</button></div><strong>${money(item.price*item.quantity)}</strong></div>`).join(""):`<div class="empty-state">Your bag is empty. Find something you like.</div>`;
  }
  async function loadCart(){
    if(supabase && session){
      const {data,error}=await supabase.from("cart_items").select("product_id,quantity,products(id,name,category,price,image_url,active)").eq("user_id",session.user.id);
      if(!error&&data){cart=data.filter(x=>x.products&&x.products.active).map(x=>({...x.products,quantity:x.quantity}));renderCart();return;}
    }
    cart=readGuestCart();renderCart();
  }
  async function addToCart(id){
    const p=products.find(x=>String(x.id)===String(id));if(!p)return;
    const existing=cart.find(x=>String(x.id)===String(id));
    if(supabase&&session){
      const newQty=(existing?.quantity||0)+1;
      const {error}=await supabase.from("cart_items").upsert({user_id:session.user.id,product_id:p.id,quantity:newQty},{onConflict:"user_id,product_id"});
      if(error){toast("Could not sync bag. Check your database setup.");return;}
      await loadCart();
    }else{
      if(existing)existing.quantity++;else cart.push({...p,quantity:1});
      persistGuestCart();renderCart();
      if(supabase&&!session)toast("Added to bag. Sign in to sync across devices.");else toast("Added to bag (demo mode).");
    }
  }
  async function setQuantity(id,delta){
    const item=cart.find(x=>String(x.id)===String(id));if(!item)return;
    const qty=item.quantity+delta;
    if(supabase&&session){
      let result;
      if(qty<=0)result=await supabase.from("cart_items").delete().eq("user_id",session.user.id).eq("product_id",id);
      else result=await supabase.from("cart_items").update({quantity:qty}).eq("user_id",session.user.id).eq("product_id",id);
      if(result.error){toast("Could not update your synced bag.");return;}await loadCart();
    }else{if(qty<=0)cart=cart.filter(x=>String(x.id)!==String(id));else item.quantity=qty;persistGuestCart();renderCart();}
  }
  async function removeCartItem(id){
    if(supabase&&session){const {error}=await supabase.from("cart_items").delete().eq("user_id",session.user.id).eq("product_id",id);if(error){toast("Could not remove item.");return;}await loadCart();}
    else{cart=cart.filter(x=>String(x.id)!==String(id));persistGuestCart();renderCart();}
  }
  function renderProducts(){
    const visible=products.filter(p=>(category==="All"||p.category===category)&&(`${p.name} ${p.category} ${p.description||""}`).toLowerCase().includes(search.toLowerCase()));
    $("#productCount").textContent=`${visible.length} item${visible.length===1?"":"s"}`;
    $("#productGrid").innerHTML=visible.length?visible.map(p=>`<article class="product-card"><div class="product-image">${p.image_url?`<img loading="lazy" src="${safe(p.image_url)}" alt="${safe(p.name)}">`:`<div class="product-placeholder">JC.</div>`}<span class="product-tag">${safe(p.category)}</span><button class="quick-add" data-add="${safe(p.id)}">ADD TO BAG — ${money(p.price)}</button></div><div class="product-info"><div class="product-category">${safe(p.category)}</div><div class="product-title">${safe(p.name)}</div><div class="product-price">${money(p.price)}${p.compare_at&&p.compare_at>p.price?`<del>${money(p.compare_at)}</del>`:""}</div></div></article>`).join(""):`<div class="empty-state">No products found. Try another search or category.</div>`;
  }
  async function loadProducts(){
    if(supabase){
      const {data,error}=await supabase.from("products").select("id,name,category,price,compare_at,description,image_url,active").eq("active",true).order("created_at",{ascending:false});
      if(!error&&data&&data.length){products=data;renderProducts();return;}
      if(error)console.warn("Product query:",error.message);
    }
    products=demoProducts;renderProducts();
    if(!supabase)$("#productCount").textContent="Demo products — connect Supabase to share real data";
  }
  function setAuthUI(){ $("#accountBtn").textContent=session?(session.user.email.split("@")[0]):"Sign in"; }
  async function submitAuth(event){
    event.preventDefault();const email=$("#authEmail").value.trim(),password=$("#authPassword").value;
    $("#authMessage").textContent="Please wait…";
    if(!supabase){$("#authMessage").textContent="Account sign-in is not connected yet. Add Supabase keys in config.js and run the SQL setup.";return;}
    let result;
    if(authMode==="signup")result=await supabase.auth.signUp({email,password,options:{emailRedirectTo:location.origin}});
    else result=await supabase.auth.signInWithPassword({email,password});
    if(result.error){$("#authMessage").textContent=result.error.message;return;}
    if(authMode==="signup"&&!result.data.session){$("#authMessage").textContent="Account created. Check your email to confirm, then sign in.";return;}
    session=result.data.session;setAuthUI();await loadCart();closePanels();toast(authMode==="signup"?"Account created.":"Signed in.");
  }
  function applyTheme(theme){
    const root=document.documentElement;
    root.style.setProperty("--accent",theme.accent||"#d9ff3f");
    root.style.setProperty("--paper",theme.background||"#f5f5f2");
    root.style.setProperty("--ink",theme.text||"#111111");
    document.body.classList.toggle("size-compact",theme.buttonSize==="compact");
    document.body.classList.toggle("size-large",theme.buttonSize==="large");
    root.style.setProperty("--columns",theme.columns||"4");
    if(theme.headline){const parts=theme.headline.trim().split(/\s+/);const first=parts.slice(0,2).join(" "),rest=parts.slice(2).join(" ");$(".hero-copy h1").innerHTML=`${safe(first)}<br><span>${safe(rest)}</span>`;}
    $("#accentPicker").value=theme.accent||"#d9ff3f";$("#backgroundPicker").value=theme.background||"#f5f5f2";$("#textPicker").value=theme.text||"#111111";$("#headlineEditor").value=theme.headline||"Wear your own rules." ;$("#buttonSize").value=theme.buttonSize||"normal";$("#columnCount").value=theme.columns||"4";
  }
  function currentTheme(){return {accent:$("#accentPicker").value,background:$("#backgroundPicker").value,text:$("#textPicker").value,headline:$("#headlineEditor").value.trim()||"Wear your own rules.",buttonSize:$("#buttonSize").value,columns:$("#columnCount").value};}
  function updateThemeFromControls(){applyTheme(currentTheme());}
  async function init(){
    $("#year").textContent=new Date().getFullYear();
    applyTheme({});await loadProducts();
    if(supabase){
      const {data}=await supabase.auth.getSession();session=data.session;setAuthUI();await loadCart();
      supabase.auth.onAuthStateChange(async(_event,newSession)=>{session=newSession;setAuthUI();await loadCart();});
    }else{await loadCart();$("#checkoutMessage").textContent="Demo mode: connect Supabase to enable accounts and shared carts.";}
    $$(".filter").forEach(btn=>btn.addEventListener("click",()=>{$$(".filter").forEach(b=>b.classList.remove("active"));btn.classList.add("active");category=btn.dataset.category;renderProducts();}));
    $("#productGrid").addEventListener("click",e=>{const btn=e.target.closest("[data-add]");if(btn)addToCart(btn.dataset.add);});
    $("#cartItems").addEventListener("click",e=>{const q=e.target.closest("[data-qty]"),r=e.target.closest("[data-remove]");if(q)setQuantity(q.dataset.qty,Number(q.dataset.delta));if(r)removeCartItem(r.dataset.remove);});
    $("#searchInput").addEventListener("input",e=>{search=e.target.value;renderProducts();});
    $("#searchBtn").addEventListener("click",()=>{$("#shop").scrollIntoView({behavior:"smooth"});$("#searchInput").focus();});
    $("#cartBtn").addEventListener("click",()=>openPanel("cartDrawer"));
    $("#accountBtn").addEventListener("click",()=>{if(session){if(confirm("Sign out of Jersey Ce?"))supabase.auth.signOut();}else{authMode="signin";$("#authTitle").textContent="Welcome back.";$("#authSubmit").textContent="SIGN IN ↗";$("#authModeToggle").textContent="New here? Create an account";openPanel("authModal");}});
    $("#authModeToggle").addEventListener("click",()=>{authMode=authMode==="signin"?"signup":"signin";$("#authTitle").textContent=authMode==="signup"?"Create your account.":"Welcome back.";$("#authSubmit").textContent=authMode==="signup"?"CREATE ACCOUNT ↗":"SIGN IN ↗";$("#authModeToggle").textContent=authMode==="signup"?"Already have an account? Sign in":"New here? Create an account";$("#authPassword").autocomplete=authMode==="signup"?"new-password":"current-password";$("#authMessage").textContent="";});
    $("#authForm").addEventListener("submit",submitAuth);
    $("#editorToggle").addEventListener("click",()=>openPanel("customizer"));
    ["accentPicker","backgroundPicker","textPicker","headlineEditor","buttonSize","columnCount"].forEach(id=>$("#"+id).addEventListener("input",updateThemeFromControls));
    $("#saveTheme").addEventListener("click",()=>{try{localStorage.setItem("jersey-ce-theme",JSON.stringify(currentTheme()));$("#themeMessage").textContent="Design saved in this browser.";toast("Design saved on this device.");}catch{$("#themeMessage").textContent="Could not save this design in your browser.";}});
    $("#resetTheme").addEventListener("click",()=>{localStorage.removeItem("jersey-ce-theme");applyTheme({});$("#themeMessage").textContent="Default design restored.";});
    try{const saved=JSON.parse(localStorage.getItem("jersey-ce-theme")||"null");if(saved)applyTheme(saved);}catch{}
    $$("[data-close]").forEach(btn=>btn.addEventListener("click",closePanels));$("#overlay").addEventListener("click",closePanels);
    document.addEventListener("keydown",e=>{if(e.key==="Escape")closePanels();});
    $("#checkoutBtn").addEventListener("click",()=>{const message=supabase&&session?"Checkout demo only. No payment is taken; connect a trusted payment provider and server-side order validation before accepting real orders.":"This is a demo checkout. Sign in and connect Supabase to sync your bag across devices.";$("#checkoutMessage").textContent=message;});
  }
  init();
})(); 
