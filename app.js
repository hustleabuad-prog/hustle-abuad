const SB_URL = "https://povwoiqpyifnqofzeyfq.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvdndvaXFweWlmbnFvZnpleWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDU3ODQsImV4cCI6MjA5MDQ4MTc4NH0.bG7RZkabX6UXWrJun8m-PGFWUN5QYra9jKXWflJehXA";
const _supabase = window.supabase.createClient(SB_URL, SB_KEY);

let allGigs = [];
let currentFilter = 'All';
let isLogin = false;

const gigsContainer = document.getElementById('gigs-container');
const searchInput = document.getElementById('search-gigs');
const pills = document.querySelectorAll('.pill');
const feedTitle = document.getElementById('feed-title');
const backBtn = document.getElementById('back-to-all');

// --- Auth UI ---
document.getElementById('open-signup').onclick = () => { isLogin = false; openModal(); };
document.getElementById('open-login').onclick = () => { isLogin = true; openModal(); };
document.getElementById('close-modal').onclick = () => document.getElementById('auth-modal').classList.remove('active');

function openModal() {
    document.getElementById('modal-title').innerText = isLogin ? "Welcome Back" : "Join Hustle";
    document.getElementById('auth-submit-btn').innerText = isLogin ? "Log In" : "Create Account";
    document.getElementById('signup-only-fields').style.display = isLogin ? 'none' : 'block';
    
    // Simple validation toggle
    document.getElementById('auth-name').required = !isLogin;
    document.getElementById('auth-whatsapp').required = !isLogin;
    
    document.getElementById('auth-modal').classList.add('active');
}

document.getElementById('toggle-auth-type').onclick = (e) => { e.preventDefault(); isLogin = !isLogin; openModal(); };

// --- Auth Logic ---
document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const submitBtn = document.getElementById('auth-submit-btn');
    
    submitBtn.innerText = "Loading...";
    submitBtn.disabled = true;

    if (isLogin) {
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) { alert(error.message); submitBtn.disabled = false; submitBtn.innerText = "Log In"; return; }
        const { data: prof } = await _supabase.from('profiles').select('*').eq('id', data.user.id).single();
        localStorage.setItem('hustle_session', JSON.stringify(prof));
    } else {
        const name = document.getElementById('auth-name').value;
        const whatsapp = document.getElementById('auth-whatsapp').value;
        const { data, error } = await _supabase.auth.signUp({ email, password });
        if (error) { alert(error.message); submitBtn.disabled = false; submitBtn.innerText = "Create Account"; return; }
        await _supabase.from('profiles').insert([{ id: data.user.id, full_name: name, whatsapp }]);
        localStorage.setItem('hustle_session', JSON.stringify({ full_name: name, whatsapp, id: data.user.id }));
    }
    location.reload();
};

// --- Gigs Logic ---
async function loadGigs(filterByUser = false) {
    let query = _supabase.from('gigs').select('*, profiles(whatsapp, full_name)').order('created_at', { ascending: false });
    
    if (filterByUser) {
        const { data: { user } } = await _supabase.auth.getUser();
        if(!user) return alert("Please log in first.");
        query = query.eq('poster_id', user.id);
        feedTitle.innerText = "My Posted Gigs";
        backBtn.style.display = "block";
    } else {
        feedTitle.innerText = "Active Feed";
        backBtn.style.display = "none";
    }

    const { data, error } = await query;
    if (data) {
        allGigs = data;
        filterAndRender();
    }
}

function filterAndRender() {
    const term = searchInput.value.toLowerCase();
    const filtered = allGigs.filter(g => {
        const matchesSearch = g.title.toLowerCase().includes(term) || g.description.toLowerCase().includes(term);
        const matchesCat = currentFilter === 'All' || g.category === currentFilter;
        return matchesSearch && matchesCat;
    });

    const session = JSON.parse(localStorage.getItem('hustle_session'));
    const currentUserId = session?.id || null;

    // --- Empty State UI ---
    if (filtered.length === 0) {
        gigsContainer.innerHTML = `
            <div class="empty-state">
                <h3>No gigs found 🏜️</h3>
                <p>Looks like there's nothing here right now.</p>
                ${session ? `<button class="btn-primary" onclick="document.getElementById('gTitle').focus()">Be the first to post!</button>` : ''}
            </div>
        `;
        return;
    }

    gigsContainer.innerHTML = filtered.map(g => {
        const isOwner = g.poster_id === currentUserId;
        const waLink = `https://wa.me/${g.profiles?.whatsapp}?text=Hi, I saw your gig "${g.title}"!`;
        const isFilled = g.is_filled;
        
        // Conditional Rendering based on Ownership and Status
        let actionHTML = '';
        if (isFilled) {
            actionHTML = `<button class="btn-action" style="background: transparent; border: 1px dashed var(--glass-border); color: var(--text-dim);" disabled>Completed</button>`;
        } else if (isOwner) {
            actionHTML = `<button class="btn-action" onclick="markGigFilled(${g.id})">Mark as Filled ✓</button>`;
        } else {
            actionHTML = `<a href="${waLink}" target="_blank" class="btn-primary w-full" style="padding:10px;">Accept Gig 💬</a>`;
        }

        return `
            <div class="gig-card ${isFilled ? 'filled' : ''}">
                <div style="display:flex; justify-content:space-between; align-items: center; margin-bottom:12px;">
                    <span style="color:var(--cyber-cyan); font-weight:800; font-size:0.8rem;">${g.category}</span> 
                    ${isFilled ? `<span class="badge-filled">FILLED</span>` : `<span style="font-weight: 800; color: #fff;">${g.price}</span>`}
                </div>
                <h3>${g.title}</h3>
                <p style="color:var(--text-dim); margin:15px 0; font-size:0.9rem;">${g.description}</p>
                ${actionHTML}
            </div>
        `;
    }).join('');
}

// --- Status Actions ---
window.markGigFilled = async (id) => {
    if (confirm("Mark this gig as filled? It will be greyed out for others.")) {
        const { error } = await _supabase.from('gigs').update({ is_filled: true }).eq('id', id);
        if (error) alert("Error: Make sure you added 'is_filled' to Supabase!");
        else loadGigs(feedTitle.innerText === "My Posted Gigs");
    }
};

// --- Filters & Search ---
searchInput.oninput = filterAndRender;
pills.forEach(pill => {
    pill.onclick = () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentFilter = pill.dataset.cat;
        filterAndRender();
    };
});

document.getElementById('view-my-gigs').onclick = () => loadGigs(true);
backBtn.onclick = () => {
    // Reset filters when going back to all
    currentFilter = 'All';
    pills.forEach(p => p.classList.remove('active'));
    pills[0].classList.add('active');
    searchInput.value = '';
    loadGigs(false);
};

// --- Post Gig Form ---
document.getElementById('gig-form').onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-gig-btn');
    submitBtn.innerText = "Publishing...";
    submitBtn.disabled = true;

    const { data: { user } } = await _supabase.auth.getUser();
    
    const gig = {
        title: document.getElementById('gTitle').value,
        price: document.getElementById('gPrice').value,
        description: document.getElementById('gDesc').value,
        category: document.getElementById('gCategory').value,
        poster_id: user.id,
        is_filled: false
    };

    const { error } = await _supabase.from('gigs').insert([gig]);
    if (error) {
        alert(error.message);
        submitBtn.innerText = "Publish Gig";
        submitBtn.disabled = false;
    } else {
        location.reload();
    }
};

// Start
loadGigs();
const session = JSON.parse(localStorage.getItem('hustle_session'));
if (session) {
    document.getElementById('logged-out-state').style.display = 'none';
    document.getElementById('logged-in-state').style.display = 'flex';
    document.getElementById('post-gig-area').style.display = 'block';
    document.getElementById('display-name').innerText = session.full_name.split(' ')[0];
}

document.getElementById('logout-btn').onclick = () => {
    localStorage.removeItem('hustle_session');
    _supabase.auth.signOut();
    location.reload();
};