// Veri saklama için LocalStorage kullanımı
const STORAGE_KEYS = {
    STUDENTS: 'dershane_students',
    ATTENDANCE_HISTORY: 'dershane_attendance_history',
    ARCHIVED_STUDENTS: 'dershane_archived_students',
    THEME: 'dershane_theme'
};

// İsim normalizasyonu - gereksiz boşlukları temizle ve Title Case yap (Türkçe karakterler için)
function normalizeName(name) {
    return name
        .trim() // Baş ve son boşlukları temizle
        .replace(/\s+/g, ' ') // Birden fazla boşluğu tek boşluğa çevir
        .toLocaleLowerCase('tr-TR') // Türkçe locale ile küçük harfe çevir (İ → i, I → ı)
        .split(' ') // Kelimelere ayır
        .map(word => {
            // Türkçe locale ile ilk harfi büyük yap
            return word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1);
        })
        .join(' '); // Birleştir
}

// Sayfa yüklendiğinde çalışacak fonksiyonlar
document.addEventListener('DOMContentLoaded', function() {
    loadStudents();
    loadAttendanceList(); // İlk açılışta yoklama listesini yükle
    updateCurrentDate();
    loadTheme(); // Kaydedilmiş temayı yükle
    setupThemeToggle(); // Tema değiştirici kurulum
    setupPwa();
    
    // Modal dışına tıklayınca kapatma
    window.addEventListener('click', function(event) {
        const importModal = document.getElementById('import-confirm-modal');
        const deleteModal = document.getElementById('delete-confirm-modal');
        const exportModal = document.getElementById('export-success-modal');
        
        if (event.target === importModal) {
            closeImportConfirmModal();
        }
        if (event.target === deleteModal) {
            closeDeleteConfirmModal();
        }
        if (event.target === exportModal) {
            closeExportSuccessModal();
        }
    });
});

// Sekme değiştirme
function showTab(tabName, button) {
    // Tüm sekmeleri gizle
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    // Tüm butonlardan active class'ını kaldır
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    // Seçili sekmeyi göster
    document.getElementById(`${tabName}-tab`).classList.add('active');
    const activeButton = button || document.querySelector(`.tab-btn[onclick^="showTab('${tabName}'"]`);
    if (activeButton) activeButton.classList.add('active');

    // Yoklama sekmesine geçildiğinde listeyi güncelle
    if (tabName === 'attendance') {
        loadAttendanceList();
    }
    
    // Geçmiş sekmesine geçildiğinde geçmişi yükle
    if (tabName === 'history') {
        loadHistory();
    }
    
    // İstatistikler sekmesine geçildiğinde istatistikleri yükle
    if (tabName === 'statistics') {
        loadMonthOptions();
        loadStatistics();
    }
    
    // Ayarlar sekmesine geçildiğinde arşiv listesini temizle (sadece butona basınca göster)
    if (tabName === 'settings') {
        document.getElementById('archived-list').innerHTML = '';
    }
}

// Öğrenci ekleme
function addStudent() {
    const input = document.getElementById('student-name');
    const rawName = input.value.trim();

    if (rawName === '') {
        alert('Lütfen bir öğrenci adı girin!');
        return;
    }

    // İsmi normalize et
    const name = normalizeName(rawName);
    const students = getStudents();
    
    // Aynı isimde öğrenci var mı kontrol et
    if (students.some(s => s.name === name)) {
        alert('Bu isimde bir öğrenci zaten var!');
        return;
    }

    // Arşivde aynı isimli öğrenci var mı kontrol et
    const archived = getArchivedStudents();
    const archivedStudent = archived.find(s => s.name === name);
    
    if (archivedStudent) {
        // Arşivden geri getir
        students.push({
            id: archivedStudent.id,
            name: archivedStudent.name
        });
        
        // Arşivden çıkar
        const newArchived = archived.filter(s => s.name !== name);
        saveArchivedStudents(newArchived);
        
        alert(`${name} arşivden geri getirildi! Eski yoklama kayıtları korundu.`);
    } else {
        // Yeni öğrenci ekle
        students.push({
            id: Date.now(),
            name: name
        });
    }

    saveStudents(students);
    input.value = '';
    loadStudents();
}

// Çoklu öğrenci ekleme
function addMultipleStudents() {
    const textarea = document.getElementById('multiple-students');
    const input = textarea.value.trim();
    
    if (input === '') {
        alert('Lütfen öğrenci adlarını girin!');
        return;
    }
    
    // Hem virgül hem satır başı ile ayır
    let names = input.split(/[,\n]/).map(name => name.trim()).filter(name => name !== '');
    
    if (names.length === 0) {
        alert('Geçerli öğrenci adı bulunamadı!');
        return;
    }
    
    const students = getStudents();
    const archived = getArchivedStudents();
    let addedCount = 0;
    let restoredCount = 0;
    let duplicateCount = 0;
    let duplicateNames = [];
    
    names.forEach(rawName => {
        const name = normalizeName(rawName);
        
        // Aynı isimde aktif öğrenci var mı kontrol et
        if (students.some(s => s.name === name)) {
            duplicateCount++;
            duplicateNames.push(name);
            return;
        }
        
        // Arşivde aynı isimli öğrenci var mı kontrol et
        const archivedStudent = archived.find(s => s.name === name);
        
        if (archivedStudent) {
            // Arşivden geri getir
            students.push({
                id: archivedStudent.id,
                name: archivedStudent.name
            });
            
            // Arşivden çıkar
            const index = archived.findIndex(s => s.name === name);
            if (index > -1) {
                archived.splice(index, 1);
            }
            
            restoredCount++;
        } else {
            // Yeni öğrenci ekle
            students.push({
                id: Date.now() + Math.random(), // Benzersiz ID için
                name: name
            });
            addedCount++;
        }
    });
    
    // Verileri kaydet
    saveStudents(students);
    if (restoredCount > 0) {
        saveArchivedStudents(archived);
    }
    
    // Sonuç mesajı
    let message = '';
    if (addedCount > 0) message += `✅ ${addedCount} yeni öğrenci eklendi.\n`;
    if (restoredCount > 0) message += `♻️ ${restoredCount} öğrenci arşivden geri getirildi.\n`;
    if (duplicateCount > 0) {
        message += `⚠️ ${duplicateCount} öğrenci zaten mevcut:\n`;
        message += duplicateNames.slice(0, 5).join(', ');
        if (duplicateCount > 5) message += ` ve ${duplicateCount - 5} diğer...`;
    }
    
    alert(message || 'Hiçbir değişiklik yapılmadı.');
    
    // Formu temizle ve listeyi yenile
    if (addedCount > 0 || restoredCount > 0) {
        textarea.value = '';
    }
    loadStudents();
}

// Öğrenci silme (arşive taşı)
function deleteStudent(id) {
    if (!confirm('Bu öğrenci arşivlenecek. Yoklama kayıtları korunacak ve aynı isimle tekrar eklendiğinde geri gelecek. Onaylıyor musunuz?')) {
        return;
    }

    let students = getStudents();
    const student = students.find(s => s.id === id);
    
    if (student) {
        // Arşive ekle
        const archived = getArchivedStudents();
        archived.push(student);
        saveArchivedStudents(archived);
        
        // Aktif listeden çıkar
        students = students.filter(s => s.id !== id);
        saveStudents(students);
        loadStudents();
        
        alert(`${student.name} arşivlendi. Aynı isimle tekrar eklerseniz tüm verileri geri gelecek.`);
    }
}

// Öğrenci listesini yükleme
function loadStudents() {
    const students = getStudents();
    const listContainer = document.getElementById('student-list');

    if (students.length === 0) {
        listContainer.innerHTML = '<p class="empty-message">Henüz öğrenci eklenmemiş.</p>';
        return;
    }

    listContainer.innerHTML = students.map(student => `
        <div class="student-item">
            <span class="student-name">${student.name}</span>
            <button class="btn-delete" onclick="deleteStudent(${student.id})">Sil</button>
        </div>
    `).join('');
}

// Yoklama listesini yükleme
function loadAttendanceList() {
    const students = getStudents();
    const listContainer = document.getElementById('attendance-list');

    if (students.length === 0) {
        listContainer.innerHTML = '<p class="empty-message">Önce öğrenci eklemeniz gerekiyor.</p>';
        return;
    }

    // Eğer kaydedilmiş seçimler yoksa, varsayılan seçimleri oluştur
    if (!window.attendanceSelections) {
        window.attendanceSelections = {};
        students.forEach(student => {
            window.attendanceSelections[student.id] = 'present'; // Varsayılan: Var
        });
    }
    
    // HTML'i oluştur
    listContainer.innerHTML = students.map(student => {
        const savedStatus = window.attendanceSelections[student.id] || 'present';
        return `
            <div class="attendance-item">
                <span class="attendance-name">${student.name}</span>
                <div class="attendance-options">
                    <button class="attendance-btn ${savedStatus === 'present' ? 'selected-present' : ''}" aria-pressed="${savedStatus === 'present'}" data-id="${student.id}" data-status="present" onclick="selectAttendance(${student.id}, 'present')">Var</button>
                    <button class="attendance-btn ${savedStatus === 'absent' ? 'selected-absent' : ''}" aria-pressed="${savedStatus === 'absent'}" data-id="${student.id}" data-status="absent" onclick="selectAttendance(${student.id}, 'absent')">Yok</button>
                    <button class="attendance-btn ${savedStatus === 'excused' ? 'selected-excused' : ''}" aria-pressed="${savedStatus === 'excused'}" data-id="${student.id}" data-status="excused" onclick="selectAttendance(${student.id}, 'excused')">İzinli</button>
                </div>
            </div>
        `;
    }).join('');
}

// Yoklama seçimi
function selectAttendance(studentId, status) {
    // Öğrenciye ait tüm butonları bul
    const buttons = document.querySelectorAll(`[data-id="${studentId}"]`);
    
    // Tüm butonlardan seçimi kaldır
    buttons.forEach(btn => {
        btn.classList.remove('selected-present', 'selected-absent', 'selected-excused');
        btn.setAttribute('aria-pressed', 'false');
    });

    // Seçilen butona style ekle
    const selectedButton = document.querySelector(`[data-id="${studentId}"][data-status="${status}"]`);
    selectedButton.classList.add(`selected-${status}`);
    selectedButton.setAttribute('aria-pressed', 'true');
    
    // Seçimleri kaydet
    saveCurrentSelections();
}

// Mevcut seçimleri kaydet
function saveCurrentSelections() {
    const students = getStudents();
    const selections = {};
    
    students.forEach(student => {
        const buttons = document.querySelectorAll(`[data-id="${student.id}"]`);
        buttons.forEach(btn => {
            if (btn.classList.contains('selected-present')) selections[student.id] = 'present';
            if (btn.classList.contains('selected-absent')) selections[student.id] = 'absent';
            if (btn.classList.contains('selected-excused')) selections[student.id] = 'excused';
        });
    });
    
    window.attendanceSelections = selections;
}

// Önceki seçimleri geri yükle
function restoreAttendanceSelections() {
    if (!window.attendanceSelections) return;
    
    Object.keys(window.attendanceSelections).forEach(studentId => {
        const status = window.attendanceSelections[studentId];
        const buttons = document.querySelectorAll(`[data-id="${studentId}"]`);
        
        buttons.forEach(btn => {
            btn.classList.remove('selected-present', 'selected-absent', 'selected-excused');
        });
        
        const selectedButton = document.querySelector(`[data-id="${studentId}"][data-status="${status}"]`);
        if (selectedButton) {
            selectedButton.classList.add(`selected-${status}`);
        }
    });
}

// Seçimleri sıfırla
function clearAttendanceSelections() {
    window.attendanceSelections = null;
    window.editingRecordIndex = undefined;
    window.editingRecordDate = undefined;
    updateSubmitButton(false);
    loadAttendanceList();
}

// Yoklamayı kaydetme ve sonuçları gösterme
function submitAttendance() {
    const students = getStudents();
    const attendance = [];
    const vakitSelect = document.getElementById('vakit-select');
    const vakit = vakitSelect.value;
    
    // Düzenleme modunda mı kontrol et
    const isEditMode = window.editingRecordIndex !== undefined;
    
    // Yeni yoklama alınıyorsa tekrar kontrolü yap
    if (!isEditMode && checkDuplicateAttendance(vakit)) {
        const vakitText = getVakitText(vakit);
        alert(`❌ Bugün için ${vakitText} yoklaması zaten alınmış!\n\nBu vakit için yeni yoklama almak istiyorsanız, önce Geçmiş sekmesinden mevcut kaydı silin.`);
        return;
    }

    students.forEach(student => {
        const buttons = document.querySelectorAll(`[data-id="${student.id}"]`);
        let status = null;

        buttons.forEach(btn => {
            if (btn.classList.contains('selected-present')) status = 'present';
            if (btn.classList.contains('selected-absent')) status = 'absent';
            if (btn.classList.contains('selected-excused')) status = 'excused';
        });

        if (status === null) {
            alert(`${student.name} için yoklama durumu seçilmedi!`);
            throw new Error('Incomplete attendance');
        }

        attendance.push({
            id: student.id,
            name: student.name,
            status: status
        });
    });

    // Eğer düzenleme modundaysa, kaydı güncelle
    if (isEditMode) {
        updateHistoryRecord(window.editingRecordIndex, attendance, vakit, window.editingRecordDate);
        window.editingRecordIndex = undefined;
        window.editingRecordDate = undefined;
        updateSubmitButton(false);
        clearAttendanceSelections();
        alert('Yoklama başarıyla güncellendi!');
        return;
    }

    // Sonuçları göster (geçmişe kaydetme)
    showResults(attendance, vakit);
}

// Geçmiş kaydını güncelle
function updateHistoryRecord(index, attendance, vakit, originalDate) {
    let history = getAttendanceHistory();
    history[index] = {
        date: originalDate, // Orijinal tarihi koru
        vakit: vakit,
        attendance: attendance
    };
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE_HISTORY, JSON.stringify(history));
}

// Aynı gün ve aynı vakit için yoklama kontrolü
function checkDuplicateAttendance(vakit) {
    const history = getAttendanceHistory();
    const today = new Date();
    const todayStr = `${today.getDate()}-${today.getMonth()}-${today.getFullYear()}`;
    
    return history.some(record => {
        const recordDate = new Date(record.date);
        const recordDateStr = `${recordDate.getDate()}-${recordDate.getMonth()}-${recordDate.getFullYear()}`;
        return recordDateStr === todayStr && record.vakit === vakit;
    });
}

// Sonuçları modal ile gösterme
function showResults(attendance, vakit) {
    const modal = document.getElementById('result-modal');
    const resultDate = document.getElementById('result-date');
    const summary = document.getElementById('summary');
    const absentList = document.getElementById('absent-list');
    const excusedList = document.getElementById('excused-list');

    // Tarih ve vakit
    const now = new Date();
    const vakitText = getVakitText(vakit);
    resultDate.textContent = `${formatDate(now)} - ${vakitText}`;

    // Özet istatistikler
    const present = attendance.filter(a => a.status === 'present').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    const excused = attendance.filter(a => a.status === 'excused').length;
    const total = attendance.length;

    summary.innerHTML = `
        <div class="summary-item">
            <span class="summary-label">Toplam</span>
            <span class="summary-value">${total}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Var</span>
            <span class="summary-value summary-present">${present}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Yok</span>
            <span class="summary-value summary-absent">${absent}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">İzinli</span>
            <span class="summary-value summary-excused">${excused}</span>
        </div>
    `;

    // Gelmeyenler listesi
    const absentStudents = attendance.filter(a => a.status === 'absent');
    if (absentStudents.length === 0) {
        absentList.innerHTML = '<p class="empty-message">Gelmeyen öğrenci yok.</p>';
    } else {
        absentList.innerHTML = absentStudents.map(s => 
            `<div class="result-list-item">${s.name}</div>`
        ).join('');
    }

    // İzinliler listesi
    const excusedStudents = attendance.filter(a => a.status === 'excused');
    if (excusedStudents.length === 0) {
        excusedList.innerHTML = '<p class="empty-message">İzinli öğrenci yok.</p>';
    } else {
        excusedList.innerHTML = excusedStudents.map(s => 
            `<div class="result-list-item">${s.name}</div>`
        ).join('');
    }

    // Modalı göster
    modal.classList.add('active');

    // Geçici olarak sonuçları sakla (WhatsApp için)
    window.currentAttendance = attendance;
    window.currentVakit = vakit;
    window.alreadySaved = false; // Henüz kaydedilmedi
}

// Modal kapatma
function closeModal() {
    const modal = document.getElementById('result-modal');
    modal.classList.remove('active');
}

// WhatsApp'a gönderme
function sendToWhatsApp() {
    if (!window.currentAttendance) {
        alert('Yoklama verisi bulunamadı!');
        return;
    }

    const attendance = window.currentAttendance;
    const vakit = window.currentVakit || 'sabah';
    
    // Geçmişe kaydet (sadece WhatsApp'a gönderirken)
    if (!window.alreadySaved) {
        saveAttendanceHistory(attendance, vakit);
        window.alreadySaved = true;
        // WhatsApp'a gönderdikten sonra seçimleri sıfırla
        clearAttendanceSelections();
    }
    
    const now = new Date();
    const dateStr = formatDate(now);
    const vakitText = getVakitText(vakit);

    // Mesaj içeriğini oluştur
    let message = `*${vakitText} - ${dateStr}*\n`;
    message += `*YOKLAMA SONUÇLARI*\n`;
    message += `━━━━━━━━━━━━━━━━━\n\n`;

    // Gelmeyenler
    const absentStudents = attendance.filter(a => a.status === 'absent');
    if (absentStudents.length > 0) {
        message += `*GELMEYENLER (${absentStudents.length}):*\n`;
        absentStudents.forEach((s, index) => {
            message += `  ${index + 1}. ${s.name}\n`;
        });
        message += `\n`;
    }

    // İzinliler
    const excusedStudents = attendance.filter(a => a.status === 'excused');
    if (excusedStudents.length > 0) {
        message += `*İZİNLİLER (${excusedStudents.length}):*\n`;
        excusedStudents.forEach((s, index) => {
            message += `  ${index + 1}. ${s.name}\n`;
        });
    }

    // WhatsApp Web URL'si (numara olmadan - kullanıcı kendisi seçecek)
    const encodedMessage = encodeURIComponent(message);
    const whatsappURL = `https://wa.me/?text=${encodedMessage}`;

    // WhatsApp'ı aç
    window.open(whatsappURL, '_blank');
}


// SHA-256 hash fonksiyonu
// Girilen şifreyi güvenli bir şekilde hash'ler
// Web Crypto API kullanarak tarayıcıda çalışır
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Şifre kontrol fonksiyonu (SHA-256 Hash ile)
// Güvenlik: Şifre düz metin olarak saklanmaz, sadece hash karşılaştırması yapılır
async function checkPasswordAndExecute(action) {
    // Şifre değiştirmek için: python -c "import hashlib; print(hashlib.sha256('YENİ_ŞİFRE'.encode()).hexdigest())"
    const correctPasswordHash = 'a896653291d864fbafc95dbe32b23b301994906cc054c4a07f38f1f8bdfacf0f';
    
    const password = prompt('🔒 Veri yönetimi işlemleri için şifre gerekmektedir.\n\nLütfen şifreyi girin:');
    
    if (password === null) {
        // Kullanıcı iptal etti
        return;
    }
    
    // Girilen şifreyi hash'le ve karşılaştır
    const enteredPasswordHash = await hashPassword(password);
    
    if (enteredPasswordHash === correctPasswordHash) {
        // Şifre doğru, işlemi gerçekleştir
        switch(action) {
            case 'export':
                exportData();
                break;
            case 'import':
                showImportDialog();
                break;
            case 'delete':
                showDeleteConfirm();
                break;
        }
    } else {
        alert('❌ Hatalı şifre! Veri yönetimi işlemlerine erişim reddedildi.');
    }
}

// Verileri dışa aktarma
function exportData() {
    const students = getStudents();
    const history = getAttendanceHistory();
    const archived = getArchivedStudents();

    const data = {
        students: students,
        history: history,
        archived: archived,
        exportDate: new Date().toISOString()
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const filename = `dershane-yedek-${formatDateForFile(new Date())}.json`;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    
    // Başarı modal'ını göster
    showExportSuccessModal(filename);
}

// İçe aktarma dialog'u göster
function showImportDialog() {
    const modal = document.getElementById('import-confirm-modal');
    modal.classList.add('active');
}

// İçe aktarma modal'ını kapat
function closeImportConfirmModal() {
    const modal = document.getElementById('import-confirm-modal');
    modal.classList.remove('active');
}

// İçe aktarmayı onayla
function confirmImport(mode) {
    // mode: 'merge' (birleştir) veya 'overwrite' (üzerine yaz)
    window.importMode = mode || 'merge'; // Varsayılan: birleştir
    closeImportConfirmModal();
    document.getElementById('import-file').click();
}

// Veri içe aktar (Birleştirme veya Üzerine Yazma)
function importData(event) {
    const file = event.target.files[0];
    
    if (!file) {
        return;
    }
    
    if (file.type !== 'application/json') {
        alert('❌ Lütfen geçerli bir JSON dosyası seçin!');
        return;
    }
    
    const mode = window.importMode || 'merge'; // Varsayılan: birleştir
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (!data.students || !Array.isArray(data.students)) {
                alert('❌ Geçersiz dosya formatı! Öğrenci verisi bulunamadı.');
                return;
            }
            
            let importMessage = '';
            let addedCount = 0;
            let mergedCount = 0;
            let historyCount = 0;
            let archivedCount = 0;
            
            if (mode === 'overwrite') {
                // ÜZERINE YAZMA MODU - Tüm verileri sil ve yenilerini yükle
                
                // Öğrencileri içe aktar (üzerine yaz)
                if (data.students.length > 0) {
                    saveStudents(data.students);
                    importMessage += `✅ ${data.students.length} öğrenci içe aktarıldı (üzerine yazıldı).\n`;
                }
                
                // Geçmiş varsa içe aktar (üzerine yaz)
                if (data.history && Array.isArray(data.history) && data.history.length > 0) {
                    localStorage.setItem(STORAGE_KEYS.ATTENDANCE_HISTORY, JSON.stringify(data.history));
                    importMessage += `✅ ${data.history.length} yoklama kaydı içe aktarıldı (üzerine yazıldı).\n`;
                }
                
                // Arşiv varsa içe aktar (üzerine yaz)
                if (data.archived && Array.isArray(data.archived) && data.archived.length > 0) {
                    saveArchivedStudents(data.archived);
                    importMessage += `✅ ${data.archived.length} arşivlenmiş öğrenci içe aktarıldı (üzerine yazıldı).\n`;
                }
                
            } else {
                // BİRLEŞTİRME MODU - Mevcut verilerle yeni verileri birleştir
                
                // Öğrencileri birleştir
                const currentStudents = getStudents();
                const currentStudentIds = new Set(currentStudents.map(s => s.id));
                const currentStudentNames = new Set(currentStudents.map(s => s.name.toLowerCase()));
                
                data.students.forEach(student => {
                    // Aynı ID veya aynı isim (case-insensitive) varsa ekleme
                    if (!currentStudentIds.has(student.id) && !currentStudentNames.has(student.name.toLowerCase())) {
                        currentStudents.push(student);
                        addedCount++;
                    } else {
                        mergedCount++;
                    }
                });
                
                saveStudents(currentStudents);
                
                // Yoklama geçmişini birleştir
                if (data.history && Array.isArray(data.history) && data.history.length > 0) {
                    const currentHistory = getAttendanceHistory();
                    
                    // Tarih ve vakit bazlı benzersiz yoklamalar için set oluştur
                    const existingRecords = new Set(
                        currentHistory.map(record => `${record.date}-${record.vakit}`)
                    );
                    
                    data.history.forEach(record => {
                        const recordKey = `${record.date}-${record.vakit}`;
                        if (!existingRecords.has(recordKey)) {
                            currentHistory.push(record);
                            historyCount++;
                        }
                    });
                    
                    localStorage.setItem(STORAGE_KEYS.ATTENDANCE_HISTORY, JSON.stringify(currentHistory));
                }
                
                // Arşivi birleştir
                if (data.archived && Array.isArray(data.archived) && data.archived.length > 0) {
                    const currentArchived = getArchivedStudents();
                    const currentArchivedIds = new Set(currentArchived.map(s => s.id));
                    
                    data.archived.forEach(student => {
                        if (!currentArchivedIds.has(student.id)) {
                            currentArchived.push(student);
                            archivedCount++;
                        }
                    });
                    
                    saveArchivedStudents(currentArchived);
                }
                
                // Birleştirme sonuç mesajı
                if (addedCount > 0) {
                    importMessage += `✅ ${addedCount} yeni öğrenci eklendi.\n`;
                }
                if (mergedCount > 0) {
                    importMessage += `ℹ️ ${mergedCount} öğrenci zaten mevcut (atlandı).\n`;
                }
                if (historyCount > 0) {
                    importMessage += `✅ ${historyCount} yeni yoklama kaydı eklendi.\n`;
                }
                if (archivedCount > 0) {
                    importMessage += `✅ ${archivedCount} arşiv kaydı eklendi.\n`;
                }
            }
            
            // Başarı mesajını göster
            if (importMessage) {
                alert(`🎉 İçe Aktarma Tamamlandı!\n\n${importMessage}`);
            } else {
                alert('ℹ️ Hiçbir yeni veri eklenmedi (tüm veriler zaten mevcut).');
            }
            
            // Listeleri yenile
            loadStudents();
            loadHistory();
            
        } catch (error) {
            alert('❌ Dosya okunamadı! Geçerli bir JSON dosyası seçin.');
            console.error('Import error:', error);
        }
    };
    
    reader.readAsText(file);
    
    // Input'u temizle
    event.target.value = '';
    
    // Import mode'u sıfırla
    window.importMode = null;
}

// Geçmiş yoklamaları yükleme
function loadHistory() {
    const history = getAttendanceHistory();
    const listContainer = document.getElementById('history-list');

    if (history.length === 0) {
        listContainer.innerHTML = '<p class="empty-message">Henüz yoklama geçmişi yok.</p>';
        return;
    }

    // En yeni tarih en üstte olsun
    const sortedHistory = [...history].reverse();

    listContainer.innerHTML = sortedHistory.map((record, index) => {
        const recordDate = new Date(record.date);
        const dateStr = formatDate(recordDate);
        const vakitText = getVakitText(record.vakit || 'sabah');
        
        const present = record.attendance.filter(a => a.status === 'present').length;
        const absent = record.attendance.filter(a => a.status === 'absent').length;
        const excused = record.attendance.filter(a => a.status === 'excused').length;
        const total = record.attendance.length;

        const absentStudents = record.attendance.filter(a => a.status === 'absent');
        const excusedStudents = record.attendance.filter(a => a.status === 'excused');
        
        // Son 24 saat kontrolü
        const now = new Date();
        const hoursDiff = (now - recordDate) / (1000 * 60 * 60);
        const canEdit = hoursDiff <= 24;

        return `
            <div class="history-item">
                <div class="history-header">
                    <div>
                        <h3>${dateStr}</h3>
                        <span class="vakit-badge">${vakitText}</span>
                    </div>
                    <button class="btn-delete-small" onclick="deleteHistoryRecord(${history.length - 1 - index})" title="Bu kaydı sil">×</button>
                </div>
                <div class="history-summary">
                    <span class="summary-badge">Toplam: ${total}</span>
                    <span class="summary-badge success">Var: ${present}</span>
                    <span class="summary-badge danger">Yok: ${absent}</span>
                    <span class="summary-badge warning">İzinli: ${excused}</span>
                </div>
                ${absentStudents.length > 0 ? `
                    <div class="history-section">
                        <strong>Gelmeyenler:</strong>
                        <div class="history-names">${absentStudents.map(s => s.name).join(', ')}</div>
                    </div>
                ` : ''}
                ${excusedStudents.length > 0 ? `
                    <div class="history-section">
                        <strong>İzinliler:</strong>
                        <div class="history-names">${excusedStudents.map(s => s.name).join(', ')}</div>
                    </div>
                ` : ''}
                <div class="history-actions">
                    ${canEdit ? `<button class="btn-edit" onclick="editHistoryRecord(${history.length - 1 - index})">Güncelle</button>` : ''}
                    <button class="btn-resend" onclick="resendFromHistory(${history.length - 1 - index})">WhatsApp'a Tekrar Gönder</button>
                </div>
            </div>
        `;
    }).join('');
}

// Geçmişten tekrar WhatsApp'a gönderme
function resendFromHistory(index) {
    const history = getAttendanceHistory();
    const record = history[index];
    
    if (!record) {
        alert('Kayıt bulunamadı!');
        return;
    }

    window.currentAttendance = record.attendance;
    window.currentVakit = record.vakit || 'sabah';
    window.alreadySaved = true; // Geçmişten gönderildiği için tekrar kaydetme
    sendToWhatsApp();
}

// Geçmiş kaydını düzenleme
function editHistoryRecord(index) {
    const history = getAttendanceHistory();
    const record = history[index];
    
    if (!record) {
        alert('Kayıt bulunamadı!');
        return;
    }
    
    // Kayıt 24 saatten eski mi kontrol et
    const recordDate = new Date(record.date);
    const now = new Date();
    const hoursDiff = (now - recordDate) / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
        alert('Sadece son 24 saat içinde alınan yoklamalar güncellenebilir!');
        return;
    }
    
    // Düzenleme modunu etkinleştir
    window.editingRecordIndex = index;
    window.editingRecordDate = record.date;
    
    // Vakit seç
    const vakitSelect = document.getElementById('vakit-select');
    vakitSelect.value = record.vakit || 'sabah';
    
    // Yoklama seçimlerini yükle
    const selections = {};
    record.attendance.forEach(att => {
        selections[att.id] = att.status;
    });
    window.attendanceSelections = selections;
    
    // Yoklama Al sekmesine geç
    showTab('attendance');
    document.querySelector('[onclick="showTab(\'attendance\')"]').click();
    
    // Kullanıcıya bilgi ver
    alert('Yoklama düzenleme moduna geçildi. Değişikliklerinizi yapın ve "Güncellemeyi Kaydet" butonuna basın.');
    
    // Butonu güncelleme moduna al
    updateSubmitButton(true);
}

// Submit butonunu güncelle
function updateSubmitButton(isEditMode) {
    const submitBtn = document.querySelector('[onclick="submitAttendance()"]');
    if (isEditMode) {
        submitBtn.textContent = 'Güncellemeyi Kaydet';
        submitBtn.classList.add('btn-warning');
        submitBtn.classList.remove('btn-success');
    } else {
        submitBtn.textContent = 'Yoklama Sonuçlarını Gör';
        submitBtn.classList.remove('btn-warning');
        submitBtn.classList.add('btn-success');
    }
}

// Geçmiş kaydını silme
function deleteHistoryRecord(index) {
    if (!confirm('Bu yoklama kaydını silmek istediğinizden emin misiniz?')) {
        return;
    }

    let history = getAttendanceHistory();
    history.splice(index, 1);
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE_HISTORY, JSON.stringify(history));
    loadHistory();
}

// Arşivlenmiş öğrencileri göster
function loadArchivedList() {
    const archived = getArchivedStudents();
    const listContainer = document.getElementById('archived-list');

    if (archived.length === 0) {
        listContainer.innerHTML = '<p class="empty-message">Arşivde öğrenci yok.</p>';
        return;
    }

    listContainer.innerHTML = '<div style="margin-top: 15px;">' + archived.map(student => `
        <div class="archived-item">
            <span class="student-name">${student.name}</span>
            <div class="archived-actions">
                <button class="btn-restore" onclick="restoreStudent(${student.id})">Geri Getir</button>
                <button class="btn-delete-permanent" onclick="permanentDeleteStudent(${student.id})">Kalıcı Sil</button>
            </div>
        </div>
    `).join('') + '</div>';
}

// Arşivden öğrenciyi geri getir
function restoreStudent(id) {
    const archived = getArchivedStudents();
    const student = archived.find(s => s.id === id);
    
    if (!student) {
        alert('Öğrenci bulunamadı!');
        return;
    }
    
    const students = getStudents();
    
    // Aktif listede aynı isimde biri var mı kontrol et
    if (students.some(s => s.name === student.name)) {
        alert('Bu isimde bir öğrenci zaten aktif listede var!');
        return;
    }
    
    // Aktif listeye ekle
    students.push(student);
    saveStudents(students);
    
    // Arşivden çıkar
    const newArchived = archived.filter(s => s.id !== id);
    saveArchivedStudents(newArchived);
    
    alert(`${student.name} geri getirildi!`);
    loadArchivedList();
    loadStudents();
}

// Öğrenciyi kalıcı olarak sil (tüm verileriyle birlikte)
function permanentDeleteStudent(id) {
    const archived = getArchivedStudents();
    const student = archived.find(s => s.id === id);
    
    if (!student) {
        alert('Öğrenci bulunamadı!');
        return;
    }
    
    if (!confirm(`${student.name} adlı öğrenci TÜM YOKLAMA VERİLERİYLE BİRLİKTE kalıcı olarak silinecek! Bu işlem geri alınamaz. Emin misiniz?`)) {
        return;
    }
    
    // Arşivden sil
    const newArchived = archived.filter(s => s.id !== id);
    saveArchivedStudents(newArchived);
    
    // Yoklama geçmişinden bu öğrencinin kayıtlarını temizle
    let history = getAttendanceHistory();
    history = history.map(record => {
        return {
            ...record,
            attendance: record.attendance.filter(a => a.id !== id)
        };
    }).filter(record => record.attendance.length > 0); // Boş kalan kayıtları da sil
    
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE_HISTORY, JSON.stringify(history));
    
    alert(`${student.name} kalıcı olarak silindi!`);
    loadArchivedList();
}

// Tüm verileri silme
// Tüm verileri sil onay modal'ını göster
function showDeleteConfirm() {
    const modal = document.getElementById('delete-confirm-modal');
    modal.classList.add('active');
}

// Tüm verileri sil modal'ını kapat
function closeDeleteConfirmModal() {
    const modal = document.getElementById('delete-confirm-modal');
    modal.classList.remove('active');
}

// Tüm verileri sil işlemini onayla
function confirmDeleteAll() {
    closeDeleteConfirmModal();
    clearAllData();
}

function clearAllData() {
    localStorage.removeItem(STORAGE_KEYS.STUDENTS);
    localStorage.removeItem(STORAGE_KEYS.ATTENDANCE_HISTORY);
    localStorage.removeItem(STORAGE_KEYS.ARCHIVED_STUDENTS);

    alert('✅ Tüm veriler silindi!');
    location.reload();
}

// Dışa aktarma başarılı modal'ını göster
function showExportSuccessModal(filename) {
    const modal = document.getElementById('export-success-modal');
    const filenameElement = document.getElementById('export-filename');
    filenameElement.textContent = `Dosya: ${filename}`;
    modal.classList.add('active');
}

// Dışa aktarma başarılı modal'ını kapat
function closeExportSuccessModal() {
    const modal = document.getElementById('export-success-modal');
    modal.classList.remove('active');
}

// Tarih güncelleme
function updateCurrentDate() {
    const dateElement = document.getElementById('current-date');
    if (dateElement) {
        dateElement.textContent = formatDate(new Date());
    }
}

// Yardımcı fonksiyonlar
function getStudents() {
    const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    return data ? JSON.parse(data) : [];
}

function saveStudents(students) {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
}

function getArchivedStudents() {
    const data = localStorage.getItem(STORAGE_KEYS.ARCHIVED_STUDENTS);
    return data ? JSON.parse(data) : [];
}

function saveArchivedStudents(students) {
    localStorage.setItem(STORAGE_KEYS.ARCHIVED_STUDENTS, JSON.stringify(students));
}


function getAttendanceHistory() {
    const data = localStorage.getItem(STORAGE_KEYS.ATTENDANCE_HISTORY);
    return data ? JSON.parse(data) : [];
}

function saveAttendanceHistory(attendance, vakit) {
    const history = getAttendanceHistory();
    
    // Yeni kayıt ekle
    history.push({
        date: new Date().toISOString(),
        vakit: vakit,
        attendance: attendance
    });
    
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE_HISTORY, JSON.stringify(history));
}

function formatDate(date) {
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month} ${year} ${dayName}`;
}

function getVakitText(vakit) {
    const vakitMap = {
        'sabah': 'Sabah Namazı',
        'ogle': 'Öğle Namazı',
        'ikindi': 'İkindi Namazı',
        'aksam': 'Akşam Namazı',
        'yatsi': 'Yatsı Namazı',
        'ozel': 'Özel'
    };
    return vakitMap[vakit] || 'Sabah Namazı';
}

function formatDateForFile(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Ay seçeneklerini yükle
function loadMonthOptions() {
    const history = getAttendanceHistory();
    const monthSelect = document.getElementById('month-select');
    
    if (history.length === 0) {
        return;
    }
    
    // Tüm benzersiz ay-yıl kombinasyonlarını bul
    const months = new Set();
    history.forEach(record => {
        const date = new Date(record.date);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.add(monthYear);
    });
    
    // Sırala (en yeni en üstte)
    const sortedMonths = Array.from(months).sort().reverse();
    
    // HTML oluştur
    monthSelect.innerHTML = '<option value="all">Tüm Zamanlar</option>';
    sortedMonths.forEach(monthYear => {
        const [year, month] = monthYear.split('-');
        const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                           'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        const monthName = monthNames[parseInt(month) - 1];
        monthSelect.innerHTML += `<option value="${monthYear}">${monthName} ${year}</option>`;
    });
}

// İstatistikleri yükle
function loadStatistics() {
    const students = getStudents();
    const history = getAttendanceHistory();
    const monthSelect = document.getElementById('month-select');
    const selectedMonth = monthSelect.value;
    const container = document.getElementById('statistics-table-container');
    
    if (students.length === 0) {
        container.innerHTML = '<p class="empty-message">Öğrenci bulunamadı.</p>';
        return;
    }
    
    if (history.length === 0) {
        container.innerHTML = '<p class="empty-message">Henüz yoklama geçmişi yok.</p>';
        return;
    }
    
    // Filtrelenmiş geçmişi al
    let filteredHistory = history;
    if (selectedMonth !== 'all') {
        filteredHistory = history.filter(record => {
            const date = new Date(record.date);
            const recordMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            return recordMonth === selectedMonth;
        });
    }
    
    if (filteredHistory.length === 0) {
        container.innerHTML = '<p class="empty-message">Seçilen dönem için yoklama kaydı bulunamadı.</p>';
        return;
    }
    
    // Her öğrenci için istatistikleri hesapla
    const stats = students.map(student => {
        const studentRecords = [];
        
        filteredHistory.forEach(record => {
            const attendance = record.attendance.find(a => a.id === student.id);
            if (attendance) {
                studentRecords.push(attendance.status);
            }
        });
        
        const total = studentRecords.length;
        const present = studentRecords.filter(s => s === 'present').length;
        const absent = studentRecords.filter(s => s === 'absent').length;
        const excused = studentRecords.filter(s => s === 'excused').length;
        // İzinli günler devam oranına dahil edilmez: Var / (Toplam - İzinli)
        const effectiveTotal = total - excused;
        const percentage = effectiveTotal > 0 ? ((present / effectiveTotal) * 100).toFixed(1) : 0;
        
        return {
            id: student.id,
            name: student.name,
            total: total,
            present: present,
            absent: absent,
            excused: excused,
            percentage: percentage
        };
    });
    
    // Tabloyu oluştur
    let tableHTML = `
        <table class="stats-table" id="stats-table">
            <thead>
                <tr>
                    <th onclick="sortTable(0)" class="sortable">Öğrenci Adı <span class="sort-icon">⇅</span></th>
                    <th onclick="sortTable(1)" class="sortable">Toplam Yoklama <span class="sort-icon">⇅</span></th>
                    <th onclick="sortTable(2)" class="sortable">Var <span class="sort-icon">⇅</span></th>
                    <th onclick="sortTable(3)" class="sortable">Yok <span class="sort-icon">⇅</span></th>
                    <th onclick="sortTable(4)" class="sortable">İzinli <span class="sort-icon">⇅</span></th>
                    <th onclick="sortTable(5)" class="sortable">Devam Oranı <span class="sort-icon">⇅</span></th>
                </tr>
            </thead>
            <tbody>
    `;
    
    stats.forEach(stat => {
        const percentageClass = stat.percentage >= 80 ? 'good' : stat.percentage >= 60 ? 'medium' : 'bad';
        tableHTML += `
            <tr>
                <td class="student-name-cell">${stat.name}</td>
                <td>${stat.total}</td>
                <td class="present-cell">${stat.present}</td>
                <td class="absent-cell">${stat.absent}</td>
                <td class="excused-cell">${stat.excused}</td>
                <td class="percentage-cell ${percentageClass}">%${stat.percentage}</td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = tableHTML;
    
    // Global değişkene kaydet (Excel export için)
    window.currentStats = stats;
}

// Excel'e aktar (HTML formatında - Excel'de açılabilir ve renkli)
function exportToExcel() {
    if (!window.currentStats || window.currentStats.length === 0) {
        alert('Dışa aktarılacak veri bulunamadı!');
        return;
    }
    
    const monthSelect = document.getElementById('month-select');
    const selectedMonth = monthSelect.options[monthSelect.selectedIndex].text;
    
    // Toplam hesapla
    const totalRecords = window.currentStats.reduce((sum, s) => sum + s.total, 0);
    const totalPresent = window.currentStats.reduce((sum, s) => sum + s.present, 0);
    const totalAbsent = window.currentStats.reduce((sum, s) => sum + s.absent, 0);
    const totalExcused = window.currentStats.reduce((sum, s) => sum + s.excused, 0);
    // İzinli günler devam oranına dahil edilmez
    const effectiveTotal = totalRecords - totalExcused;
    const avgPercentage = effectiveTotal > 0 ? ((totalPresent / effectiveTotal) * 100).toFixed(1) : 0;
    
    // En uzun öğrenci adı uzunluğunu bul
    const maxNameLength = Math.max(...window.currentStats.map(s => s.name.length));
    const nameColWidth = Math.max(150, maxNameLength * 10); // Her karakter için ~10px, minimum 150px
    
    // HTML tablosu oluştur
    let html = `
<html xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
    <meta charset="UTF-8">
    <style>
        table { 
            border-collapse: collapse; 
            width: 100%; 
            font-family: 'Calibri', Arial, sans-serif;
            table-layout: fixed;
        }
        th, td { 
            border: 1px solid #D0D0D0; 
            padding: 10px; 
            text-align: center;
            overflow: hidden;
        }
        col.name-col { width: ${nameColWidth}px; }
        col.data-col { width: 120px; }
        .header-row { background-color: #667eea; color: white; font-size: 16pt; font-weight: bold; border: 3px solid #000000; }
        .column-header { background-color: #4472C4; color: white; font-weight: bold; font-size: 12pt; border: 2px solid #000000; }
        .even-row { background-color: #F2F2F2; }
        .odd-row { background-color: #FFFFFF; }
        .present { color: #2b8a3e; font-weight: bold; }
        .absent { color: #c92a2a; font-weight: bold; }
        .excused { color: #e67700; font-weight: bold; }
        .percentage-good { background-color: #d3f9d8; color: #2b8a3e; font-weight: bold; }
        .percentage-medium { background-color: #fff3bf; color: #e67700; font-weight: bold; }
        .percentage-bad { background-color: #ffe3e3; color: #c92a2a; font-weight: bold; }
        .total-row { background-color: #2F5496; color: white; font-weight: bold; border: 3px solid #000000; font-size: 12pt; }
        td.name { text-align: left; }
    </style>
</head>
<body>
    <table>
        <colgroup>
            <col class="name-col">
            <col class="data-col">
            <col class="data-col">
            <col class="data-col">
            <col class="data-col">
            <col class="data-col">
        </colgroup>
        <tr>
            <td colspan="6" class="header-row">Aylık Yoklama İstatistikleri - ${selectedMonth}</td>
        </tr>
        <tr>
            <th class="column-header">Öğrenci Adı</th>
            <th class="column-header">Toplam Yoklama</th>
            <th class="column-header">Var</th>
            <th class="column-header">Yok</th>
            <th class="column-header">İzinli</th>
            <th class="column-header">Devam Oranı</th>
        </tr>
`;

    // Öğrenci satırları
    window.currentStats.forEach((stat, index) => {
        const rowClass = index % 2 === 0 ? 'even-row' : 'odd-row';
        let percentageClass = 'percentage-bad';
        if (stat.percentage >= 80) percentageClass = 'percentage-good';
        else if (stat.percentage >= 60) percentageClass = 'percentage-medium';
        
        html += `
        <tr class="${rowClass}">
            <td class="name">${stat.name}</td>
            <td>${stat.total}</td>
            <td class="present">${stat.present}</td>
            <td class="absent">${stat.absent}</td>
            <td class="excused">${stat.excused}</td>
            <td class="${percentageClass}">%${stat.percentage}</td>
        </tr>`;
    });

    // Toplam satırı
    html += `
        <tr class="total-row">
            <td>TOPLAM</td>
            <td>${totalRecords}</td>
            <td>${totalPresent}</td>
            <td>${totalAbsent}</td>
            <td>${totalExcused}</td>
            <td>%${avgPercentage}</td>
        </tr>
    </table>
</body>
</html>`;

    // Dosyayı indir
    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    link.download = `yoklama-istatistikleri-${dateStr}.xls`;
    
    link.click();
    URL.revokeObjectURL(url);
}

// Tablo sıralama fonksiyonu
let sortDirections = {}; // Her sütun için sıralama yönünü sakla

function sortTable(columnIndex) {
    const table = document.getElementById('stats-table');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    // Sıralama yönünü belirle (toggle)
    if (!sortDirections[columnIndex]) {
        sortDirections[columnIndex] = 'asc';
    } else {
        sortDirections[columnIndex] = sortDirections[columnIndex] === 'asc' ? 'desc' : 'asc';
    }
    
    const direction = sortDirections[columnIndex];
    
    // Satırları sırala
    rows.sort((a, b) => {
        const aValue = a.cells[columnIndex].textContent.trim();
        const bValue = b.cells[columnIndex].textContent.trim();
        
        // Eğer yüzde değeri ise, % işaretini kaldır
        const aNum = parseFloat(aValue.replace('%', ''));
        const bNum = parseFloat(bValue.replace('%', ''));
        
        // Sayısal karşılaştırma
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return direction === 'asc' ? aNum - bNum : bNum - aNum;
        }
        
        // Metin karşılaştırma
        if (direction === 'asc') {
            return aValue.localeCompare(bValue, 'tr');
        } else {
            return bValue.localeCompare(aValue, 'tr');
        }
    });
    
    // Sıralanmış satırları tabloya ekle
    rows.forEach(row => tbody.appendChild(row));
    
    // Sıralama ikonlarını güncelle
    updateSortIcons(columnIndex, direction);
}

// Sıralama ikonlarını güncelle
function updateSortIcons(activeColumn, direction) {
    const table = document.getElementById('stats-table');
    const headers = table.querySelectorAll('th');
    
    headers.forEach((header, index) => {
        const icon = header.querySelector('.sort-icon');
        if (icon) {
            if (index === activeColumn) {
                icon.textContent = direction === 'asc' ? '↑' : '↓';
                header.classList.add('sorted');
            } else {
                icon.textContent = '⇅';
                header.classList.remove('sorted');
            }
        }
    });
}

// Tema yönetimi
function loadTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    const isDark = savedTheme === 'dark';
    
    document.body.classList.toggle('dark-theme', isDark);
    updateThemeColor(isDark);
    
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.checked = isDark;
    }
}

function saveTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
}

function updateThemeColor(isDark) {
    document.querySelector('meta[name="theme-color"]').content = isDark ? '#111a2a' : '#f3f6fa';
}

function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', function() {
            const isDark = this.checked;
            document.body.classList.toggle('dark-theme', isDark);
            updateThemeColor(isDark);
            saveTheme(isDark ? 'dark' : 'light');
        });
    }
}

function setupPwa() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js').catch(error => {
                console.warn('Çevrimdışı destek etkinleştirilemedi:', error);
            });
        });
    }

    const installButton = document.getElementById('install-app');
    let installPrompt;
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        installPrompt = event;
        installButton.hidden = false;
    });
    installButton.addEventListener('click', async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
        installButton.hidden = true;
    });
    window.addEventListener('appinstalled', () => {
        installPrompt = null;
        installButton.hidden = true;
    });
}

// Enter tuşu ile öğrenci ekleme
document.addEventListener('DOMContentLoaded', function() {
    const studentInput = document.getElementById('student-name');
    if (studentInput) {
        studentInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addStudent();
            }
        });
    }
});

