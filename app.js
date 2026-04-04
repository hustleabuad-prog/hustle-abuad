// --- 0. Initialize Supabase ---
const SB_URL = "https://povwoiqpyifnqofzeyfq.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvdndvaXFweWlmbnFvZnpleWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDU3ODQsImV4cCI6MjA5MDQ4MTc4NH0.bG7RZkabX6UXWrJun8m-PGFWUN5QYra9jKXWflJehXA";
const _supabase = window.supabase.createClient(SB_URL, SB_KEY);

// --- 1. UX UTILITIES (Toasts & Skeletons) ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return; 
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : '⚠️';
    toast.innerHTML = `<span style="font-weight:800; font-size:1.1rem;">${icon}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3500);
}

const gigsContainer = document.getElementById('gigs-container');
function renderSkeletons() {
    const skeletonHTML = `
        <div class="skeleton-card">
            <div class="sk-top"><div class="skeleton-line sk-badge"></div><div class="skeleton-line sk-price"></div></div>
            <div class="skeleton-line sk-title"></div>
            <div class="skeleton-line sk-desc"></div><div class="skeleton-line sk-desc-short"></div>
            <div class="skeleton-line sk-btn"></div>
        </div>
    `;
    gigsContainer.innerHTML = skeletonHTML.repeat(6); 
}

// --- 2. State & Elements ---
let allGigs = [];
let currentCategory = 'All';
let viewMode = 'feed'; 
let isLogin = false;
let alertsEnabled = false;

const feedTitle = document.getElementById('feed-title');
const fabBtn = document.getElementById('fab-create-gig');
const navLinks = document.getElementById('nav-links');
const alertsBtn = document.getElementById('toggle-alerts-btn');

document.getElementById('mobile-menu-btn').onclick = () => navLinks.classList.toggle('active');

// --- 3. View Logic & Category Filtering ---
document.getElementById('logo-home').onclick = (e) => { e.preventDefault(); switchView('feed'); };
document.getElementById('menu-dashboard')?.addEventListener('click', () => { switchView('dashboard'); });

function switchView(mode) {
    viewMode = mode;
    navLinks.classList.remove('active');
    
    if (mode === 'dashboard') {
        document.getElementById('hero-section').style.display = 'none';
        document.getElementById('category-filters').style.display = 'none';
        if (alertsBtn) alertsBtn.style.display = 'none';
        feedTitle.innerText = "My Posted Gigs";
    } else {
        document.getElementById('hero-section').style.display = 'block';
        document.getElementById('category-filters').style.display = 'flex';
        if (alertsBtn) alertsBtn.style.display = 'block';
        feedTitle.innerText = "Live Feed";
        currentCategory = 'All';
        updateActiveChip();
    }
    loadGigs();
}

document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
        currentCategory = e.target.dataset.cat;
        updateActiveChip();
        renderGigs(); 
    });
});

function updateActiveChip() {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    document.querySelector(`.chip[data-cat="${currentCategory}"]`)?.classList.add('active');
    
    if(alertsBtn) {
        if(alertsEnabled) {
            alertsBtn.innerHTML = `<span id="alert-icon">🔔</span> Alerts On for ${currentCategory}`;
            alertsBtn.style.color = 'var(--success-green)';
            alertsBtn.style.borderColor = 'var(--success-green)';
        } else {
            alertsBtn.innerHTML = `<span id="alert-icon">🔕</span> Alerts Off`;
            alertsBtn.style.color = '';
            alertsBtn.style.borderColor = '';
        }
    }
}

if (alertsBtn) {
    alertsBtn.onclick = () => {
        alertsEnabled = !alertsEnabled;
        updateActiveChip();
        if(alertsEnabled) {
            showToast(`You will now be notified of new ${currentCategory} gigs!`);
        } else {
            showToast("Push alerts paused.");
        }
    };
}

// --- 4. Auth Logic ---
document.getElementById('open-signup').onclick = () => { isLogin = false; openModal(); navLinks.classList.remove('active');};
document.getElementById('open-login').onclick = () => { isLogin = true; openModal(); navLinks.classList.remove('active');};
document.getElementById('close-modal').onclick = () => document.getElementById('auth-modal').classList.remove('active');
document.getElementById('toggle-auth-type').onclick = (e) => { e.preventDefault(); isLogin = !isLogin; openModal(); };

function openModal() {
    document.getElementById('modal-title').innerText = isLogin ? "Welcome Back" : "Join the Hustle";
    document.getElementById('auth-submit-btn').innerText = isLogin ? "Log In" : "Create Account";
    document.getElementById('signup-only-fields').style.display = isLogin ? 'none' : 'block';
    document.getElementById('auth-name').required = !isLogin;
    document.getElementById('auth-whatsapp').required = !isLogin;
    document.getElementById('auth-modal').classList.add('active');
}

document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const submitBtn = document.getElementById('auth-submit-btn');
    
    submitBtn.innerText = "Loading...";
    submitBtn.disabled = true;

    if (isLogin) {
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) { showToast(error.message, "error"); submitBtn.disabled = false; submitBtn.innerText = "Log In"; return; }
        const { data: prof } = await _supabase.from('profiles').select('*').eq('id', data.user.id).single();
        localStorage.setItem('hustle_session', JSON.stringify(prof));
    } else {
        const name = document.getElementById('auth-name').value;
        const countryCode = document.getElementById('auth-country-code').value;
        let rawNumber = document.getElementById('auth-whatsapp').value;
        
        rawNumber = rawNumber.replace(/\D/g, ''); 
        if (rawNumber.startsWith('0')) { rawNumber = rawNumber.substring(1); }
        const finalWhatsapp = `${countryCode}${rawNumber}`;

        const { data, error } = await _supabase.auth.signUp({ email, password });
        if (error) { showToast(error.message, "error"); submitBtn.disabled = false; submitBtn.innerText = "Create Account"; return; }
        
        await _supabase.from('profiles').insert([{ id: data.user.id, full_name: name, whatsapp: finalWhatsapp }]);
        localStorage.setItem('hustle_session', JSON.stringify({ full_name: name, whatsapp: finalWhatsapp, id: data.user.id }));
    }
    location.reload();
};

// --- 5. Gig Creation Logic ---
const gigModal = document.getElementById('gig-modal');
[document.getElementById('fab-create-gig'), document.getElementById('menu-create-gig')].forEach(btn => {
    if (btn) btn.onclick = () => { gigModal.classList.add('active'); navLinks.classList.remove('active'); };
});
document.getElementById('close-gig-modal').onclick = () => gigModal.classList.remove('active');

document.getElementById('gig-form').onsubmit = async (e) => {
    e.preventDefault();
    const session = JSON.parse(localStorage.getItem('hustle_session'));
    if(!session) return showToast("Please log in first to post a gig.", "error");
    
    const title = document.getElementById('gTitle').value;
    const category = document.getElementById('gCategory').value;
    const price = document.getElementById('gPrice').value;
    const desc = document.getElementById('gDesc').value;
    const submitBtn = document.getElementById('submit-gig-btn');
    
    submitBtn.innerText = "Publishing...";
    submitBtn.disabled = true;
    
    const { error } = await _supabase.from('gigs').insert([{
        title, price, category, description: desc || '', poster_id: session.id
    }]);
    
    submitBtn.innerText = "Publish Gig";
    submitBtn.disabled = false;
    
    if(error) { showToast(error.message, "error"); } 
    else {
        showToast("Gig published successfully!");
        gigModal.classList.remove('active');
        document.getElementById('gig-form').reset();
        switchView('feed'); 
    }
};

// --- 6. Fetching & Rendering ---
async function loadGigs() {
    renderSkeletons(); 
    let query = _supabase.from('gigs').select('*, profiles(whatsapp, full_name)').order('created_at', { ascending: false });

    if (viewMode === 'dashboard') {
        const session = JSON.parse(localStorage.getItem('hustle_session'));
        if(!session) return;
        query = query.eq('poster_id', session.id);
    }

    const { data, error } = await query;
    if (data) {
        allGigs = data;
        renderGigs(); 
    } else if (error) {
        showToast("Failed to load feed.", "error");
    }
}

function renderGigs() {
    const session = JSON.parse(localStorage.getItem('hustle_session'));
    const currentUserId = session?.id || null;

    const filteredGigs = currentCategory === 'All' 
        ? allGigs 
        : allGigs.filter(g => g.category === currentCategory);

    if (filteredGigs.length === 0) {
        gigsContainer.innerHTML = `
            <div class="empty-state">
                <div style="font-size:3rem; margin-bottom:10px;">🏜️</div>
                <h3>Nothing here yet</h3>
                <p>Be the first to create a gig in this space.</p>
            </div>`;
        return;
    }

    gigsContainer.innerHTML = filteredGigs.map(g => {
        const isOwner = g.poster_id === currentUserId;
        const isFilled = g.is_filled;
        const posterName = g.profiles?.full_name?.split(' ')[0] || 'Student';
        const cleanTitle = g.title.replace(/'/g, "\\'");
        
        let actionHTML = '';
        if (isFilled) {
            actionHTML = `<button class="btn-action" disabled>Completed</button>
                          ${isOwner ? `<button class="btn-action" onclick="deleteGig(${g.id})" style="color:#ef4444; border-color:#ef4444;">Delete Gig</button>` : ''}`;
        } else if (isOwner) {
            actionHTML = `<button class="btn-action" onclick="markGigFilled(${g.id})">Mark as Completed</button>`;
        } else {
            // UPDATED: Now passes real database IDs to the chat and bid functions
            actionHTML = `
                <div class="action-group w-full">
                    <button class="btn-secondary" onclick="initiateBid(${g.id}, '${cleanTitle}', ${g.price})">Make Offer</button>
                    <button class="btn-escrow" onclick="openChat('${g.poster_id}', '${posterName}', '${cleanTitle}', ${g.id})" style="width:100%;">Message</button>
                </div>
            `;
        }

        return `
            <div class="gig-card ${isFilled ? 'filled' : ''}">
                <div style="display:flex; justify-content:space-between; align-items: flex-start; margin-bottom:15px;">
                    <div>
                        <div class="trust-badge">⭐ Verified Student</div>
                        <div style="color:var(--text-dim); font-size:0.85rem;">Posted by ${posterName}</div>
                    </div>
                    ${isFilled ? `<span class="badge-filled">FILLED</span>` : `<span style="font-weight: 800; color:var(--primary-accent); font-size: 1.2rem;">₦${g.price}</span>`}
                </div>
                <h3>${g.title}</h3>
                ${g.description ? `<p style="color:var(--text-dim); margin:8px 0 20px; font-size:0.95rem; line-height: 1.5;">${g.description}</p>` : '<div style="margin:15px 0;"></div>'}
                
                <div style="margin-top: auto;">
                    ${actionHTML}
                </div>
            </div>
        `;
    }).join('');
}

// --- 7. REALTIME IN-APP CHAT ---
const chatModal = document.getElementById('chat-modal');
const chatHistory = document.getElementById('chat-history');
let currentChatGigId = null;
let currentChatReceiverId = null;
let chatSubscription = null;

window.openChat = async (posterId, posterName, gigTitle, gigId) => {
    const session = JSON.parse(localStorage.getItem('hustle_session'));
    if(!session) return showToast("Log in to message users.", "error");

    currentChatGigId = gigId;
    currentChatReceiverId = posterId;

    document.getElementById('chat-user-name').innerText = posterName;
    document.getElementById('chat-gig-title').innerText = `Re: ${gigTitle}`;
    chatModal.classList.add('active');
    
    // Load existing messages from Database
    chatHistory.innerHTML = '<p style="text-align:center; color:var(--text-dim);">Loading messages...</p>';
    const { data: messages } = await _supabase.from('messages')
        .select('*')
        .eq('gig_id', gigId)
        .order('created_at', { ascending: true });
        
    renderMessages(messages, session.id);

    // REALTIME MAGIC: Subscribe to new incoming messages
    if(chatSubscription) _supabase.removeChannel(chatSubscription);
    
    chatSubscription = _supabase.channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `gig_id=eq.${gigId}` }, payload => {
            const newMsg = payload.new;
            // Only append if I didn't send it (to prevent double rendering)
            if(newMsg.sender_id !== session.id) {
                chatHistory.innerHTML += `<div class="chat-bubble them">${newMsg.content}</div>`;
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }
        })
        .subscribe();
};

function renderMessages(messages, myId) {
    if(!messages || messages.length === 0) {
        chatHistory.innerHTML = '<p style="text-align:center; color:var(--text-dim); margin-top:20px;">No messages yet. Say hi!</p>';
        return;
    }
    chatHistory.innerHTML = messages.map(m => {
        const type = m.sender_id === myId ? 'me' : 'them';
        return `<div class="chat-bubble ${type}">${m.content}</div>`;
    }).join('');
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

document.getElementById('close-chat-modal').onclick = () => {
    chatModal.classList.remove('active');
    if(chatSubscription) _supabase.removeChannel(chatSubscription);
};

// Send Message to Database
document.getElementById('chat-form').onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-message');
    const content = input.value;
    const session = JSON.parse(localStorage.getItem('hustle_session'));
    if(!content || !session) return;

    // Optimistic UI render (shows up instantly for me)
    chatHistory.innerHTML += `<div class="chat-bubble me">${content}</div>`;
    input.value = '';
    chatHistory.scrollTop = chatHistory.scrollHeight;

    // Save to Database
    await _supabase.from('messages').insert([{
        gig_id: currentChatGigId,
        sender_id: session.id,
        receiver_id: currentChatReceiverId,
        content: content
    }]);
};

// --- 8. REAL DATABASE BIDDING ---
const bidModal = document.getElementById('bid-modal');
let currentBidGigId = null;

window.initiateBid = (gigId, title, originalPrice) => {
    const session = JSON.parse(localStorage.getItem('hustle_session'));
    if(!session) return showToast("Log in to make offers.", "error");

    currentBidGigId = gigId;
    document.getElementById('bid-task-name').innerText = title;
    document.getElementById('bPrice').value = originalPrice; 
    bidModal.classList.add('active');
};

document.getElementById('close-bid-modal').onclick = () => bidModal.classList.remove('active');

document.getElementById('bid-form').onsubmit = async (e) => {
    e.preventDefault();
    const session = JSON.parse(localStorage.getItem('hustle_session'));
    const btn = document.getElementById('submit-bid-btn');
    btn.innerText = "Sending...";
    btn.disabled = true;
    
    const price = document.getElementById('bPrice').value;
    const note = document.getElementById('bNote').value;

    const { error } = await _supabase.from('bids').insert([{
        gig_id: currentBidGigId,
        bidder_id: session.id,
        price: price,
        note: note
    }]);

    if(error) {
        showToast("Error sending offer.", "error");
    } else {
        showToast("Offer securely saved to Database!");
        bidModal.classList.remove('active');
        document.getElementById('bid-form').reset();
    }
    
    btn.innerText = "Send Offer";
    btn.disabled = false;
};

// --- 9. Basic DB Actions ---
window.markGigFilled = async (id) => {
    if (confirm("Mark this gig as completed?")) {
        await _supabase.from('gigs').update({ is_filled: true }).eq('id', id);
        showToast("Gig marked as completed.");
        loadGigs();
    }
};

window.deleteGig = async (id) => {
    if (confirm("Permanently delete this gig?")) {
        await _supabase.from('gigs').delete().eq('id', id);
        showToast("Gig deleted.");
        loadGigs();
    }
};

// --- 10. Initialization ---
const session = JSON.parse(localStorage.getItem('hustle_session'));
if (session) {
    document.getElementById('logged-out-state').style.display = 'none';
    document.getElementById('logged-in-state').style.display = 'flex';
    fabBtn.style.display = 'flex'; 
    if (alertsBtn) alertsBtn.style.display = 'block';
    document.getElementById('display-name').innerText = session.full_name.split(' ')[0];
}
switchView('feed'); 

document.getElementById('logout-btn').onclick = () => {
    localStorage.removeItem('hustle_session');
    _supabase.auth.signOut();
    location.reload();
};