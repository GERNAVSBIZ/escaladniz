
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDocs, getDoc, deleteDoc, updateDoc, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Configuração & Constantes ---
const firebaseConfig = {
    apiKey: "AIzaSyApoDIAXZ5_6GlytJp6IyesM-6epXDqo6k",
    authDomain: "dashboard-escala.firebaseapp.com",
    projectId: "dashboard-escala",
    storageBucket: "dashboard-escala.appspot.com",
    messagingSenderId: "451393122794",
    appId: "1:451393122794:web:24f125f11ef3260b770293"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Habilitar persistência offline
enableIndexedDbPersistence(db)
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn('Persistência falhou: Múltiplas abas abertas.');
        } else if (err.code == 'unimplemented') {
            console.warn('Persistência não suportada neste navegador.');
        }
    });

const SHIFT_CONFIG = {
    'A': { hours: 8, color: 'bg-yellow-200', text: 'text-yellow-800', name: 'Manhã' },
    'B': { hours: 8, color: 'bg-sky-200', text: 'text-sky-800', name: 'Tarde' },
    'C': { hours: 8, color: 'bg-blue-200', text: 'text-blue-800', name: 'Noite' },
    'HA': { hours: 8, color: 'bg-green-200', text: 'text-green-800', name: 'Adm' },
    'VS': { hours: 8, color: 'bg-cyan-200', text: 'text-cyan-800', name: 'Viagem' },
    'IS': { hours: 8, color: 'bg-teal-200', text: 'text-teal-800', name: 'Insp. Saúde' },
    'X': { hours: 0, color: 'bg-gray-100', text: 'text-gray-400', name: 'Folga' },
    'CHE': { hours: 0, color: 'bg-purple-200', text: 'text-purple-800', name: 'Comp. Hora' },
    'FC': { hours: 0, color: 'bg-purple-300', text: 'text-purple-900', name: 'Folga Comp.' },
    'FF': { hours: 0, color: 'bg-orange-200', text: 'text-orange-800', name: 'Feriado' },
    'FA': { hours: 0, color: 'bg-gray-300', text: 'text-gray-900', name: 'Ajuste' },
    'FE': { hours: 0, color: 'bg-pink-200', text: 'text-pink-800', name: 'Férias' },
    'R': { hours: 0, color: 'bg-pink-300', text: 'text-pink-900', name: 'Recesso' },
    'AM': { hours: 0, color: 'bg-red-200', text: 'text-red-800', name: 'Atestado' },
    'LM': { hours: 0, color: 'bg-rose-200', text: 'text-rose-800', name: 'Lic. Mat.' },
    'LP': { hours: 0, color: 'bg-fuchsia-200', text: 'text-fuchsia-800', name: 'Lic. Pat.' },
    'SE': { hours: 0, color: 'bg-slate-300', text: 'text-slate-800', name: 'Sobreaviso' },
    '---': { hours: 0, color: 'bg-white', text: 'text-gray-300', name: 'Vazio' }
};

const ADMIN_EMAILS = ["admin@example.com"]; // SUBSTITUA PELOS EMAILS REAIS DEPOIS
const ADMIN_NAMES = ["Wilkson", "Adriano", "Admin"]; // Mantido para compatibilidade
const MANAGER_NAME = "WILKSON";

// --- Hooks Personalizados ---

const useAuthUser = () => {
    const [user, setUser] = React.useState(null);
    const [userData, setUserData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                // Tenta ler do cache primeiro (padrão do Firestore) depois server
                const userRef = doc(db, `artifacts/${firebaseConfig.projectId}/users`, currentUser.uid);

                try {
                    const userSnap = await getDoc(userRef);

                    let data;
                    if (!userSnap.exists()) {
                        // Check Email OR Name (Fallback)
                        const isAdmin = ADMIN_EMAILS.includes(currentUser.email) || ADMIN_NAMES.some(name => currentUser.displayName?.toLowerCase().includes(name.toLowerCase()));
                        data = {
                            uid: currentUser.uid,
                            displayName: currentUser.displayName,
                            email: currentUser.email,
                            status: isAdmin ? 'approved' : 'pending',
                            isAdmin: isAdmin
                        };
                        await setDoc(userRef, data);
                    } else {
                        data = userSnap.data();
                        // Grant admin if email matches and not yet admin
                        if ((ADMIN_EMAILS.includes(currentUser.email) || ADMIN_NAMES.some(name => currentUser.displayName?.toLowerCase().includes(name.toLowerCase()))) && !data.isAdmin) {
                            data.isAdmin = true;
                            await updateDoc(userRef, { isAdmin: true });
                        }
                    }
                    setUserData(data);
                } catch (e) {
                    console.error("Erro ao carregar usuário (offline?)", e);
                    // Se estiver offline e não tiver cache, pode falhar userSnap. 
                    // Mas com persistence enabled, getDoc deve retornar cache se existir.
                }
            } else {
                setUser(null);
                setUserData(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const login = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Login failed", error);
            alert("Erro ao fazer login: " + error.message);
        }
    };

    const logout = async () => await signOut(auth);

    return { user, userData, loading, login, logout };
};

// --- Componentes UI Reutilizáveis ---

const Loader = () => (
    <div className="flex justify-center items-center h-full p-10">
        <i className="fas fa-circle-notch fa-spin text-4xl text-indigo-600"></i>
    </div>
);

const Button = ({ children, onClick, variant = 'primary', className = '', ...props }) => {
    const variants = {
        primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
        secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
        danger: 'bg-red-500 text-white hover:bg-red-600',
        success: 'bg-green-600 text-white hover:bg-green-700',
        ghost: 'bg-transparent text-gray-500 hover:bg-gray-100'
    };
    return (
        <button
            onClick={onClick}
            className={`h-12 px-4 rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center gap-2 active:scale-95 ${variants[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

const Select = ({ value, onChange, options, label }) => (
    <div className="w-full relative">
        {label && <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">{label}</label>}
        <div className="relative">
            <select
                value={value}
                onChange={onChange}
                className="w-full h-12 pl-4 pr-10 bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
            >
                {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                <i className="fas fa-chevron-down text-xs"></i>
            </div>
        </div>
    </div>
);

const OfflineStatus = () => {
    const [isOffline, setIsOffline] = React.useState(!navigator.onLine);

    React.useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!isOffline) return null;

    return (
        <div className="bg-red-500 text-white text-center py-1 text-xs font-bold sticky top-0 z-50">
            <i className="fas fa-wifi-slash mr-2"></i>
            Você está offline. Alterações serão salvas quando a conexão retornar.
        </div>
    );
};

const ProjectionScreen = ({ user, userData, schedule }) => {
    const [refDate, setRefDate] = React.useState('');
    const [targetDate, setTargetDate] = React.useState('');
    const [result, setResult] = React.useState(null);

    const calculate = () => {
        if (!refDate || !targetDate) return;

        const ref = new Date(refDate + 'T00:00:00');
        const target = new Date(targetDate + 'T00:00:00');
        ref.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);

        if (target < ref) {
            alert("A data futura deve ser posterior à data de referência.");
            return;
        }

        const diffTime = Math.abs(target - ref);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Ciclo 3x2 = 5 dias.
        // Dia 0 (Ref) = Último dia da folga (2º dia de folga)
        // Dia 1 = 1º Dia Trabalho
        // Dia 2 = 2º Dia Trabalho
        // Dia 3 = 3º Dia Trabalho
        // Dia 4 = 1º Dia Folga
        // Dia 5 (0) = 2º Dia Folga

        const remainder = diffDays % 5;
        let status = '';
        let subStatus = '';
        let color = '';
        let icon = '';

        if (remainder === 1) {
            status = 'TRABALHO';
            subStatus = '1º Dia de Trabalho';
            color = 'bg-blue-100 text-blue-800 border-blue-300';
            icon = 'fa-briefcase';
        } else if (remainder === 2) {
            status = 'TRABALHO';
            subStatus = '2º Dia de Trabalho';
            color = 'bg-blue-200 text-blue-900 border-blue-400';
            icon = 'fa-briefcase';
        } else if (remainder === 3) {
            status = 'TRABALHO';
            subStatus = '3º Dia de Trabalho (Último)';
            color = 'bg-indigo-200 text-indigo-900 border-indigo-400';
            icon = 'fa-briefcase';
        } else if (remainder === 4) {
            status = 'FOLGA';
            subStatus = '1º Dia de Folga';
            color = 'bg-green-100 text-green-800 border-green-300';
            icon = 'fa-umbrella-beach';
        } else { // remainder === 0
            status = 'FOLGA';
            subStatus = '2º Dia de Folga (Último)';
            color = 'bg-green-200 text-green-900 border-green-400';
            icon = 'fa-glass-cheers';
        }

        setResult({ status, subStatus, color, icon, days: diffDays, date: target.toLocaleDateString('pt-BR') });
    };

    return (
        <div className="p-4 space-y-6 max-w-md mx-auto">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-50">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <i className="fas fa-calculator text-indigo-600"></i> Projeção 3x2
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Último dia da sua folga</label>
                        <input
                            type="date"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={refDate}
                            onChange={e => setRefDate(e.target.value)}
                        />
                        <p className="text-xs text-gray-400 mt-1">Dia zero do ciclo (o 2º dia da folga)</p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Data Futura</label>
                        <input
                            type="date"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={targetDate}
                            onChange={e => setTargetDate(e.target.value)}
                        />
                    </div>

                    <Button onClick={calculate} className="w-full">
                        Calcular
                    </Button>
                </div>
            </div>

            {result && (
                <div className={`p-6 rounded-xl border-l-4 shadow-sm text-center animate-bounce-in ${result.color}`}>
                    <p className="text-sm font-medium opacity-75 mb-1">{result.date}</p>
                    <div className="text-4xl mb-2"><i className={`fas ${result.icon}`}></i></div>
                    <h3 className="text-3xl font-bold tracking-wider">{result.status}</h3>
                    <p className="text-lg font-semibold mt-1 opacity-90">{result.subStatus}</p>
                </div>
            )}

            <div className="text-center text-xs text-gray-400 mt-10">
                <p>Ciclo Padrão: 3 Dias Trabalho / 2 Dias Folga</p>
            </div>
        </div>
    );
};

// --- Componentes Principais ---

const PendingApprovalScreen = ({ onLogout }) => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-orange-50 p-6 text-center">
        <i className="fas fa-clock text-5xl text-orange-400 mb-6"></i>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Aguardando Aprovação</h2>
        <p className="text-gray-600 mb-8">Seu cadastro foi recebido. Aguarde a liberação de um administrador (Wilkson/Adriano).</p>
        <Button onClick={onLogout} variant="secondary">Sair</Button>
    </div>
);

// Sub-componente: Célula da Tabela
const ScheduleCell = ({ shift, onClick, isToday, isSelected, isChanged, isPendingSwap, isCurrentMonth }) => {
    const config = SHIFT_CONFIG[shift] || SHIFT_CONFIG['---'];

    let classes = `h-10 w-10 md:h-12 md:w-12 flex items-center justify-center font-bold text-sm rounded-md transition-all `;

    if (isCurrentMonth) {
        classes += config.color + ' ' + config.text;
        classes += isToday ? ' ring-2 ring-blue-500 ring-offset-1 ' : '';
        classes += isSelected ? ' ring-4 ring-indigo-500 z-20 scale-110 shadow-lg ' : '';
        classes += isChanged ? ' ring-2 ring-orange-400 z-10 ' : '';
        classes += isPendingSwap ? ' animate-pulse ring-2 ring-green-500 z-10 ' : '';
    } else {
        classes += ' grayscale-cell ';
        classes += isSelected ? ' ring-4 ring-gray-400 z-20 ' : '';
    }

    return (
        <div className="p-1 min-w-[3rem] md:min-w-[3.5rem]" onClick={onClick}>
            <div className={classes}>
                {shift}
            </div>
        </div>
    );
};


// Helper para status do dia (Legacy Logic)
function getDayStatusArray(dateHeaders) {
    const dayStatus = [];
    let currentStatus = 'previous';
    for (let i = 0; i < dateHeaders.length; i++) {
        if (i > 0 && parseInt(dateHeaders[i]) < parseInt(dateHeaders[i - 1])) {
            currentStatus = currentStatus === 'previous' ? 'current' : 'next';
        }
        if (dateHeaders[i] === '1' && currentStatus === 'previous') {
            currentStatus = 'current';
        }
        dayStatus.push(currentStatus);
    }
    return dayStatus;
}

// Sub-componente: Tabela de Escala
const ScheduleTable = ({ schedule, pendingSwaps, onCellClick, selectedCell }) => {
    const { scheduleData, dateHeaders, monthName, year } = schedule;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calcula status visual dos dias (Cinza/Normal)
    const dayStatuses = getDayStatusArray(dateHeaders);
    const scrollContainerRef = React.useRef(null);

    // Helpers para cálculo do dia da semana
    const MONTH_MAP_IDX = { 'JANEIRO': 0, 'FEVEREIRO': 1, 'MARÇO': 2, 'ABRIL': 3, 'MAIO': 4, 'JUNHO': 5, 'JULHO': 6, 'AGOSTO': 7, 'SETEMBRO': 8, 'OUTUBRO': 9, 'NOVEMBRO': 10, 'DEZEMBRO': 11 };
    const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    // Hook para Auto-Scroll para o dia atual
    React.useEffect(() => {
        const timer = setTimeout(() => {
            const todayElement = document.getElementById('scroll-target-today');
            if (scrollContainerRef.current && todayElement) {
                const stickyOffset = 120;
                const scrollPos = todayElement.offsetLeft - stickyOffset;

                scrollContainerRef.current.scrollTo({
                    left: scrollPos > 0 ? scrollPos : 0,
                    behavior: 'smooth'
                });
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [schedule.monthName]);

    const isTodayFunc = (dayStr, status) => {
        if (status !== 'current') return false;
        const d = parseInt(dayStr);
        const monthNames = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
        return d === today.getDate() && new Date().getMonth() === monthNames.indexOf(monthName.toUpperCase());
    };

    return (
        <div
            id="table-container"
            ref={scrollContainerRef}
            className="overflow-auto custom-scrollbar bg-white rounded-xl shadow-sm border border-gray-200 -mx-4 md:mx-0 relative"
        >
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-gray-100 border-b border-gray-200">
                        <th className="p-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider sticky-col min-w-[120px]">Operador</th>
                        {dateHeaders.map((day, idx) => {
                            const status = dayStatuses[idx];
                            const isCurrent = status === 'current';
                            const isToday = isTodayFunc(day, status);

                            // Cálculo do Dia da Semana
                            let targetYear = parseInt(year);
                            const monthIdx = MONTH_MAP_IDX[monthName.toUpperCase()];
                            let targetMonth = monthIdx;

                            if (status === 'previous') {
                                targetMonth = monthIdx - 1;
                                if (targetMonth < 0) { targetMonth = 11; targetYear--; }
                            } else if (status === 'next') {
                                targetMonth = monthIdx + 1;
                                if (targetMonth > 11) { targetMonth = 0; targetYear++; }
                            }

                            const dateObj = new Date(targetYear, targetMonth, parseInt(day));
                            const weekDay = WEEKDAYS[dateObj.getDay()];

                            return (
                                <th
                                    key={idx}
                                    id={isToday ? "scroll-target-today" : undefined}
                                    className={`p-2 text-center min-w-[3rem] ${isToday ? 'bg-blue-50' : ''}`}
                                >
                                    <div className="flex flex-col items-center justify-center">
                                        <div className={`text-xs font-bold leading-tight ${isCurrent ? (isToday ? 'text-blue-600' : 'text-gray-600') : 'text-gray-300'}`}>
                                            {day}
                                        </div>
                                        <div className={`text-[9px] uppercase leading-tight mt-0.5 ${isCurrent ? (isToday ? 'text-blue-500' : 'text-gray-400') : 'text-gray-200'}`}>
                                            {weekDay}
                                        </div>
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {scheduleData.map((op, opIndex) => (
                        <tr key={opIndex} className="hover:bg-gray-50">
                            <td className="p-3 text-sm font-semibold text-gray-700 sticky-col whitespace-nowrap bg-white truncate max-w-[120px]">
                                {op.name}
                            </td>
                            {op.shifts.map((shift, dayIndex) => {
                                const pending = pendingSwaps.find(s =>
                                    (parseInt(s.initiator.opIndex) === opIndex && parseInt(s.initiator.dayIndex) === dayIndex) ||
                                    (parseInt(s.recipient.opIndex) === opIndex && parseInt(s.recipient.dayIndex) === dayIndex)
                                );

                                const isSelected = selectedCell && selectedCell.opIndex == opIndex && selectedCell.dayIndex == dayIndex;
                                const status = dayStatuses[dayIndex];
                                const isCurrentMonth = status === 'current';

                                return (
                                    <td key={dayIndex} className="p-0 text-center">
                                        <ScheduleCell
                                            shift={shift}
                                            isToday={isTodayFunc(dateHeaders[dayIndex], status)}
                                            isSelected={isSelected}
                                            isPendingSwap={!!pending}
                                            isCurrentMonth={isCurrentMonth}
                                            onClick={() => onCellClick(opIndex, dayIndex, op.name, shift, isCurrentMonth)}
                                        />
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// --- App Principal ---

const App = () => {
    const { user, userData, loading, login, logout } = useAuthUser();
    const [activeTab, setActiveTab] = React.useState('home');
    const [currentScheduleId, setCurrentScheduleId] = React.useState(null);
    const [schedule, setSchedule] = React.useState(null);
    const [schedulesList, setSchedulesList] = React.useState([]);
    const [pendingSwaps, setPendingSwaps] = React.useState([]);
    const [pendingUsers, setPendingUsers] = React.useState([]);

    // UI States
    const [isEditModalOpen, setEditModalOpen] = React.useState(false);
    const [selectedCell, setSelectedCell] = React.useState(null);
    const [swapMode, setSwapMode] = React.useState(false);
    const [swapSelection, setSwapSelection] = React.useState(null);
    const [toast, setToast] = React.useState(null);

    // --- Effects ---

    React.useEffect(() => {
        // Carregar lista assim que montar, não depende mais de 'user' ser aprovado (modo anônimo)
        loadSchedulesList();
    }, []);

    React.useEffect(() => {
        if (user && userData?.isAdmin) loadPendingUsers();
    }, [user, userData]);

    React.useEffect(() => {
        if (currentScheduleId) {
            loadSchedule(currentScheduleId);
            loadSwapRequests(currentScheduleId);
        } else {
            setSchedule(null);
        }
    }, [currentScheduleId]);

    // Auto-load current month
    React.useEffect(() => {
        if (schedulesList.length > 0 && !currentScheduleId) {
            const today = new Date();
            const monthNames = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

            // New Format: YYYY-MM-NAME
            const currentIdNew = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${monthNames[today.getMonth()]}`;
            // Old Format: MM-YYYY-NAME (Legacy compatibility)
            const currentIdOld = `${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}-${monthNames[today.getMonth()]}`;

            if (schedulesList.includes(currentIdNew)) {
                setCurrentScheduleId(currentIdNew);
            } else if (schedulesList.includes(currentIdOld)) {
                setCurrentScheduleId(currentIdOld);
            } else {
                setCurrentScheduleId(schedulesList[schedulesList.length - 1]);
            }
        }
    }, [schedulesList]);

    // --- Logic Functions ---

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const loadSchedulesList = async () => {
        try {
            const snap = await getDocs(collection(db, `artifacts/${firebaseConfig.projectId}/schedules`));
            const ids = snap.docs.map(d => d.id).sort();
            setSchedulesList(ids);
        } catch (e) {
            console.error(e);
            if (e.code === 'permission-denied') {
                // Silently fail or show message if needed. Data won't load if rules block it.
            }
        }
    };

    const loadSchedule = async (id) => {
        try {
            const docSnap = await getDoc(doc(db, `artifacts/${firebaseConfig.projectId}/schedules`, id));
            if (docSnap.exists()) {
                setSchedule(docSnap.data());
            }
        } catch (e) { console.error(e); }
    };

    const loadSwapRequests = async (scheduleId) => {
        try {
            const snap = await getDocs(collection(db, `artifacts/${firebaseConfig.projectId}/swapRequests`));
            const swaps = snap.docs.map(d => d.data()).filter(r => r.scheduleId === scheduleId);
            setPendingSwaps(swaps);
        } catch (e) { console.error(e); }
    };

    const loadPendingUsers = async () => {
        try {
            const snap = await getDocs(collection(db, `artifacts/${firebaseConfig.projectId}/users`));
            const pending = snap.docs.map(d => d.data()).filter(u => u.status === 'pending');
            setPendingUsers(pending);
        } catch (e) { console.error(e); }
    };

    const handleDeleteSchedule = async () => {
        if (!currentScheduleId) return;
        if (!confirm(`Tem certeza que deseja DELETAR PERMANENTEMENTE a escala ${currentScheduleId}?`)) return;

        try {
            await deleteDoc(doc(db, `artifacts/${firebaseConfig.projectId}/schedules`, currentScheduleId));
            showToast("Escala deletada com sucesso!");
            setSchedule(null);
            setCurrentScheduleId(null);
            await loadSchedulesList();
        } catch (error) {
            showToast("Erro ao deletar escala", "error");
            console.error(error);
        }
    };

    // Função para Download do CSV (Adicionada)
    const handleDownloadCSV = () => {
        if (!schedule) {
            showToast("Nenhuma escala carregada para baixar", "error");
            return;
        }

        try {
            // Reconstrói o formato CSV (Compatível com o Parser de Importação)
            let lines = [];

            // Cabeçalhos (Linhas 0 a 3 - Simula o cabeçalho original)
            lines.push(`${schedule.monthName};;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;`); // Mês
            lines.push(";;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;");
            lines.push(";;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;");
            lines.push(`${schedule.year};;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;`); // Ano

            // Linhas de preenchimento (4 a 10) para garantir que o parser encontre a linha de datas no lugar certo
            for (let i = 4; i < 11; i++) {
                lines.push(";;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;");
            }

            // Linha de Datas (O parser espera: ;1;2;3...)
            lines.push(";" + schedule.dateHeaders.join(";"));

            // Linhas de Dados (Operadores e Turnos)
            schedule.scheduleData.forEach(op => {
                // Formato: "Nome";A;B;F...
                lines.push(`"${op.name}";${op.shifts.join(";")}`);
            });

            const csvContent = lines.join("\r\n");

            // Cria o Blob (UTF-8 com BOM para acentuação funcionar no Excel)
            const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            // Cria o link invisível e clica
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `Escala_${schedule.monthName}_${schedule.year}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast("Download iniciado!");
        } catch (e) {
            console.error(e);
            showToast("Erro ao gerar CSV", "error");
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const lines = event.target.result.split(/\r\n?|\n/);
            let scheduleData = [], dateHeaders = [], monthName = '', year = '', DATE_ROW = -1, DATA_START = -1;

            // Heurística Específica: Pular 10 linhas, procurar (vazio;numero...)
            // Isso evita pegar a linha de contadores (1,1,1...) que está antes
            for (let i = 10; i < lines.length; i++) {
                const parts = lines[i].split(';');
                if (parts[0].trim() === '' && parts.length > 15 && !isNaN(parseInt(parts[1]?.trim(), 10))) {
                    DATE_ROW = i; DATA_START = i + 1; break
                }
            }
            if (DATE_ROW === -1) { showToast('Formato CSV inválido (Data Row não encontrada)', 'error'); return; }

            try {
                // Tenta pegar mês nas primeiras 5 linhas (estilo antigo) ou na linha 0
                const mLine = lines[0].split(';')[0].trim();
                // Se mLine for vazio, tente procurar
                if (mLine.length > 2) {
                    monthName = mLine.charAt(0).toUpperCase() + mLine.slice(1).toLowerCase();
                } else {
                    // Fallback check rows 0-5
                    for (let r = 0; r < 5; r++) {
                        const check = lines[r].split(';')[0].trim();
                        if (check.length > 3 && isNaN(check)) {
                            monthName = check.charAt(0).toUpperCase() + check.slice(1).toLowerCase();
                            break;
                        }
                    }
                }

                // Ano - Geralmente linha 3
                const l3 = lines[3] ? lines[3].split(';')[0].trim() : '';
                year = l3.match(/^20\d{2}$/) ? l3 : new Date().getFullYear();
            } catch (e) { }

            // Processar Cabeçalhos (com limpeza de aspas e preenchimento inteligente)
            const rawHeaders = lines[DATE_ROW].split(';');
            dateHeaders = [];

            // Começa do índice 1 (pula nome) até o fim
            // Preserva colunas vazias se estiverem entre números (ex: 30 -> "" -> 1)
            for (let i = 1; i < rawHeaders.length; i++) {
                let val = rawHeaders[i].trim().replace(/"/g, '');

                // Correção específica: Dia 31 vazio
                if (val === '') {
                    const prev = dateHeaders[dateHeaders.length - 1];
                    // Se o anterior foi 30, assume que este é 31 (mesmo que o próximo seja 1 ou nada)
                    if (prev === '30') {
                        val = '31';
                    }
                }

                // Só adiciona se for número válido ou se foi corrigido para '31'
                // Para parar de ler lixo no final da linha, verifica se parou de vir números
                // Mas precisamos ter cuidado para não parar no buraco do 31.
                if (val && !isNaN(val)) {
                    dateHeaders.push(val);
                } else if (val === '' && dateHeaders.length > 0) {
                    // Se encontrou vazio e não era o 31, pode ser o fim da linha útil ou apenas uma falha.
                    // Vamos verificar se tem mais números à frente.
                    const hasMoreNumbers = rawHeaders.slice(i + 1).some(h => h.trim() && !isNaN(h.trim().replace(/"/g, '')));
                    if (hasMoreNumbers) {
                        // Se tem mais números, mantém o buraco como '?' ou tenta inferir? 
                        // Por enquanto, vamos ignorar se não for o caso do 30->31. 
                        // O filtro original ignorava. Se não tratamos 30->31 acima, aqui seria ignorado.
                    } else {
                        // Fim da linha útil
                        break;
                    }
                }
            }

            // Processar Dados
            for (let i = DATA_START; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const parts = line.split(';');
                const operatorName = parts[0].trim().replace(/"/g, '');

                // Filtro para ignorar linhas ruins
                if (operatorName.length > 2 && isNaN(operatorName) && operatorName !== 'PNA' && !operatorName.includes('LEGENDA')) {
                    const shifts = parts.slice(1, dateHeaders.length + 1).map(s => {
                        const cs = s.trim().replace(/"/g, '');
                        return SHIFT_CONFIG[cs] ? cs : '---';
                    });
                    if (shifts.length === dateHeaders.length) scheduleData.push({ name: operatorName, shifts });
                }
            }

            const MONTH_MAP = { 'JANEIRO': '01', 'FEVEREIRO': '02', 'MARÇO': '03', 'ABRIL': '04', 'MAIO': '05', 'JUNHO': '06', 'JULHO': '07', 'AGOSTO': '08', 'SETEMBRO': '09', 'OUTUBRO': '10', 'NOVEMBRO': '11', 'DEZEMBRO': '12' };
            const mCode = MONTH_MAP[monthName.toUpperCase()] || '01';
            const newId = `${year}-${mCode}-${monthName.toUpperCase()}`;

            // Persistência
            const newSchedule = { scheduleData, dateHeaders, monthName: monthName.toUpperCase(), year: String(year), originalCsvLines: lines };

            await setDoc(doc(db, `artifacts/${firebaseConfig.projectId}/schedules`, newId), newSchedule);
            showToast('Escala carregada com sucesso!');
            await loadSchedulesList();
            setCurrentScheduleId(newId);
            setActiveTab('home');
        };
        reader.readAsText(file, 'ISO-8859-1');
    };

    const handleCellClick = (opIndex, dayIndex, opName, shift, isCurrentMonth) => {
        // Verificação de Login
        if (!user || userData?.status !== 'approved') {
            showToast("Faça login para realizar ações.", "error");
            return;
        }

        if (!isCurrentMonth) return;

        if (swapMode) {
            if (!swapSelection) {
                setSwapSelection({ opIndex, dayIndex, opName, shift });
                showToast("Selecione o destino da troca");
            } else {
                if (swapSelection.opIndex === opIndex && swapSelection.dayIndex === dayIndex) {
                    setSwapSelection(null);
                    return;
                }
                const requestData = {
                    id: `${currentScheduleId}_${Date.now()}`,
                    scheduleId: currentScheduleId,
                    initiator: swapSelection,
                    recipient: { opIndex, dayIndex, opName, shift },
                    status: 'pending',
                    timestamp: new Date().toISOString()
                };
                setDoc(doc(db, `artifacts/${firebaseConfig.projectId}/swapRequests`, requestData.id), requestData)
                    .then(() => {
                        showToast("Solicitação de troca enviada!");
                        setSwapMode(false);
                        setSwapSelection(null);
                        loadSwapRequests(currentScheduleId);
                    });
            }
        } else {
            if (userData.isAdmin || userData.displayName.toLowerCase().includes(opName.toLowerCase())) {
                setSelectedCell({ opIndex, dayIndex, opName, shift });
                setEditModalOpen(true);
            } else {
                showToast("Você só pode editar seus turnos", "error");
            }
        }
    };

    const saveShiftChange = async (newShift) => {
        if (!selectedCell || !schedule) return;
        const newData = [...schedule.scheduleData];
        newData[selectedCell.opIndex].shifts[selectedCell.dayIndex] = newShift;

        try {
            await updateDoc(doc(db, `artifacts/${firebaseConfig.projectId}/schedules`, currentScheduleId), {
                scheduleData: newData,
                lastUpdated: new Date().toISOString()
            });
            setSchedule({ ...schedule, scheduleData: newData });
            setEditModalOpen(false);
            showToast("Turno atualizado!");
        } catch (e) {
            showToast("Erro ao salvar", "error");
        }
    };

    const handleAdminAction = async (uid, action) => {
        try {
            const ref = doc(db, `artifacts/${firebaseConfig.projectId}/users`, uid);
            if (action === 'approve') await updateDoc(ref, { status: 'approved' });
            else await deleteDoc(ref);
            loadPendingUsers();
            showToast(action === 'approve' ? "Usuário aprovado" : "Usuário removido");
        } catch (e) { showToast("Erro na ação", "error"); }
    };

    const toggleSwapMode = () => {
        if (!user || userData?.status !== 'approved') {
            showToast("Faça login para realizar trocas.", "error");
            return;
        }
        setSwapMode(!swapMode);
        setSwapSelection(null);
    };

    // --- Renders ---

    if (loading) return <div className="min-h-screen flex items-center justify-center"><i className="fas fa-spinner fa-spin text-4xl text-indigo-600"></i></div>;

    // Se estiver logado, mas pendente, bloqueia a tela
    if (user && userData?.status !== 'approved') return <PendingApprovalScreen onLogout={logout} />;

    // Se não estiver logado, ou se estiver logado e aprovado, renderiza o App Principal
    return (
        <div className="min-h-screen pb-24">
            <OfflineStatus />
            {/* Header */}
            <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center sticky top-0 z-40">
                <div className="flex items-center gap-2">
                    <div className="bg-indigo-600 text-white p-2 rounded-lg">
                        <i className="fas fa-layer-group"></i>
                    </div>
                    <div>
                        <h1 className="font-bold text-gray-800 leading-tight">Escala DNIZ</h1>
                        <p className="text-xs text-gray-500">
                            {schedule ? `${schedule.monthName} ${schedule.year}` : (user ? 'Nenhuma escala' : 'Modo Visitante')}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {!user ? (
                        <button onClick={login} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow hover:bg-indigo-700 flex items-center gap-2">
                            <i className="fab fa-google"></i> Entrar
                        </button>
                    ) : (
                        <button onClick={logout} className="w-10 h-10 flex items-center justify-center bg-red-50 rounded-full text-red-500 hover:bg-red-100">
                            <i className="fas fa-sign-out-alt"></i>
                        </button>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="p-4 fade-in">
                {activeTab === 'home' && (
                    <>
                        <div className="mb-4">
                            <Select
                                options={schedulesList.length > 0 ? schedulesList.map(id => ({ value: id, label: id })) : [{ value: '', label: 'Nenhuma escala disponível' }]}
                                value={currentScheduleId || ''}
                                onChange={(e) => setCurrentScheduleId(e.target.value)}
                            />
                        </div>

                        {schedule ? (
                            <>
                                <div className="flex gap-2 mb-4">
                                    <Button
                                        className={`flex-1 text-sm ${!user ? 'opacity-50' : ''}`}
                                        variant={swapMode ? 'danger' : 'primary'}
                                        onClick={toggleSwapMode}
                                    >
                                        <i className={`fas ${swapMode ? 'fa-times' : 'fa-exchange-alt'} mr-2`}></i>
                                        {swapMode ? 'Cancelar Troca' : 'Trocar Turnos'}
                                    </Button>
                                </div>
                                {swapMode && <div className="bg-yellow-100 text-yellow-800 p-2 rounded mb-4 text-xs text-center font-medium">Toque no turno de origem, depois no destino (apenas mês atual).</div>}

                                {pendingSwaps.length > 0 && user && (
                                    <div className="mb-6 space-y-2">
                                        <h3 className="font-bold text-gray-700 text-sm">Trocas Pendentes</h3>
                                        {pendingSwaps.map(req => {
                                            // Proteção para não quebrar se userData for null (não deve acontecer aqui pois verificamos user &&)
                                            const isMe = userData?.displayName?.toLowerCase().includes(req.recipient.opName.toLowerCase());
                                            if (!isMe && !userData?.isAdmin) return null;

                                            return (
                                                <div key={req.id} className="bg-white p-3 rounded-lg shadow-sm border-l-4 border-blue-500 text-sm">
                                                    <p className="mb-2">
                                                        <span className="font-bold">{req.initiator.opName}</span> ({req.initiator.shift}) <i className="fas fa-arrow-right text-gray-400 mx-1"></i> <span className="font-bold">{req.recipient.opName}</span> ({req.recipient.shift})
                                                    </p>
                                                    {isMe && (
                                                        <div className="flex gap-2 mt-2">
                                                            <button onClick={async () => {
                                                                const newData = [...schedule.scheduleData];
                                                                const i = req.initiator, r = req.recipient;
                                                                newData[i.opIndex].shifts[i.dayIndex] = r.shift;
                                                                newData[r.opIndex].shifts[r.dayIndex] = i.shift;
                                                                await updateDoc(doc(db, `artifacts/${firebaseConfig.projectId}/schedules`, currentScheduleId), { scheduleData: newData });
                                                                await deleteDoc(doc(db, `artifacts/${firebaseConfig.projectId}/swapRequests`, req.id));
                                                                setSchedule({ ...schedule, scheduleData: newData });
                                                                loadSwapRequests(currentScheduleId);
                                                                showToast("Troca aceita!");
                                                            }} className="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-bold">Aceitar</button>

                                                            <button onClick={async () => {
                                                                await deleteDoc(doc(db, `artifacts/${firebaseConfig.projectId}/swapRequests`, req.id));
                                                                loadSwapRequests(currentScheduleId);
                                                                showToast("Recusada");
                                                            }} className="bg-red-100 text-red-700 px-3 py-1 rounded text-xs font-bold">Recusar</button>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                <ScheduleTable
                                    schedule={schedule}
                                    pendingSwaps={pendingSwaps}
                                    onCellClick={handleCellClick}
                                    selectedCell={swapSelection || selectedCell}
                                />
                            </>
                        ) : (
                            <div className="text-center py-10 text-gray-500">
                                <i className="fas fa-folder-open text-4xl mb-2 text-gray-300"></i>
                                <p>Nenhuma escala carregada ou selecionada.</p>
                                {!user && <p className="text-xs text-indigo-600 mt-2" onClick={login}>Faça login se você é Admin.</p>}
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'stats' && schedule && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-gray-800">Estatísticas</h2>
                        {schedule.scheduleData.map((op, idx) => {
                            const statuses = getDayStatusArray(schedule.dateHeaders);
                            const hours = op.shifts.reduce((acc, s, i) => {
                                if (statuses[i] !== 'current') return acc;
                                return acc + (SHIFT_CONFIG[s]?.hours || 0);
                            }, 0);

                            return (
                                <div key={idx} className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center">
                                    <span className="font-medium text-gray-700">{op.name}</span>
                                    <span className="text-lg font-bold text-indigo-600">{hours}h</span>
                                </div>
                            )
                        })}
                    </div>
                )}

                {activeTab === 'projection' && (
                    <ProjectionScreen user={user} userData={userData} schedule={schedule} />
                )}

                {activeTab === 'admin' && userData?.isAdmin && (
                    <div className="space-y-6">
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-indigo-100">
                            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                <i className="fas fa-cog text-indigo-600"></i> Gerenciamento de Escalas
                            </h3>
                            <div className="space-y-3">
                                <label className="block">
                                    <span className="text-sm font-semibold text-gray-600 mb-1 block">Carregar Nova Escala (CSV)</span>
                                    <div className="flex items-center justify-center w-full">
                                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <i className="fas fa-cloud-upload-alt text-3xl text-gray-400 mb-2"></i>
                                                <p className="text-sm text-gray-500"><span className="font-semibold">Clique para enviar</span></p>
                                            </div>
                                            <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                                        </label>
                                    </div>
                                </label>

                                {currentScheduleId && (
                                    <div className="pt-2">
                                        <Button
                                            onClick={handleDownloadCSV}
                                            variant="secondary"
                                            className="w-full mb-2"
                                        >
                                            <i className="fas fa-download mr-2"></i> Baixar CSV Atual
                                        </Button>
                                        <Button
                                            onClick={handleDeleteSchedule}
                                            variant="danger"
                                            className="w-full"
                                        >
                                            <i className="fas fa-trash mr-2"></i> Deletar Escala Atual
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {pendingUsers.length > 0 && (
                            <div className="bg-white p-5 rounded-lg shadow-sm border border-orange-100">
                                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <i className="fas fa-users-cog text-orange-500"></i> Aprovações Pendentes
                                </h3>
                                <div className="space-y-3">
                                    {pendingUsers.map(u => (
                                        <div key={u.uid} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                                            <div>
                                                <p className="font-bold text-sm text-gray-700">{u.displayName}</p>
                                                <p className="text-xs text-gray-500">{u.email}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleAdminAction(u.uid, 'approve')} className="p-2 text-green-600 hover:bg-green-100 rounded"><i className="fas fa-check"></i></button>
                                                <button onClick={() => handleAdminAction(u.uid, 'reject')} className="p-2 text-red-600 hover:bg-red-100 rounded"><i className="fas fa-times"></i></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-between items-center z-40 pb-safe">
                <button
                    onClick={() => setActiveTab('home')}
                    className={`flex flex-col items-center gap-1 text-xs font-medium transition-colors ${activeTab === 'home' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <i className="fas fa-calendar-alt text-xl mb-0.5"></i>
                    Escala
                </button>
                <button
                    onClick={() => setActiveTab('stats')}
                    className={`flex flex-col items-center gap-1 text-xs font-medium transition-colors ${activeTab === 'stats' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <i className="fas fa-chart-pie text-xl mb-0.5"></i>
                    Estatísticas
                </button>
                <button
                    onClick={() => setActiveTab('projection')}
                    className={`flex flex-col items-center gap-1 text-xs font-medium transition-colors ${activeTab === 'projection' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <i className="fas fa-calculator text-xl mb-0.5"></i>
                    Projeção
                </button>
                {userData?.isAdmin && (
                    <button
                        onClick={() => setActiveTab('admin')}
                        className={`flex flex-col items-center gap-1 text-xs font-medium transition-colors ${activeTab === 'admin' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <i className="fas fa-user-shield text-xl mb-0.5"></i>
                        {pendingUsers.length > 0 && <span className="absolute top-3 ml-4 w-2 h-2 bg-red-500 rounded-full"></span>}
                        Admin
                    </button>
                )}
            </nav>

            {/* Modais & Toasts */}
            {toast && (
                <div className={`fixed bottom-24 left-4 right-4 p-4 rounded-lg shadow-lg text-white text-center font-bold text-sm transition-all ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-600'} z-50`}>
                    {toast.msg}
                </div>
            )}

            {isEditModalOpen && selectedCell && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
                        <div className="p-4 border-b bg-gray-50">
                            <h3 className="font-bold text-gray-800">Editar Turno</h3>
                            <p className="text-sm text-gray-500">{selectedCell.opName} - Dia {selectedCell.dayIndex + 1}</p>
                        </div>
                        <div className="p-6">
                            <Select
                                label="Novo Turno"
                                value={selectedCell.shift}
                                onChange={(e) => setSelectedCell({ ...selectedCell, shift: e.target.value })}
                                options={Object.entries(SHIFT_CONFIG).map(([k, v]) => ({ value: k, label: `${k} - ${v.name}` }))}
                            />
                        </div>
                        <div className="p-4 flex gap-3 bg-gray-50">
                            <Button variant="secondary" className="flex-1" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
                            <Button className="flex-1" onClick={() => saveShiftChange(selectedCell.shift)}>Salvar</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
