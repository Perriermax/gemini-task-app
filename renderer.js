document.addEventListener('DOMContentLoaded', async () => {
    const normalView = document.getElementById('normal-view');
    const focusView = document.getElementById('focus-view');
    const focusTaskTitle = document.getElementById('focus-task-title');
    const focusTimerDisplay = document.getElementById('focus-timer-display');
    const focusStartBtn = document.getElementById('focus-start-btn');
    const focusPauseBtn = document.getElementById('focus-pause-btn');
    const focusResetBtn = document.getElementById('focus-reset-btn');
    const exitFocusBtn = document.getElementById('exit-focus-btn');

    const taskInput = document.getElementById('task-input');
    const estimatedTimeInput = document.getElementById('estimated-time-input');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskList = document.getElementById('task-list');

    // Pomodoro elements
    const workDurationInput = document.getElementById('work-duration');
    const breakDurationInput = document.getElementById('break-duration');
    const pomodoroDisplay = document.getElementById('pomodoro-display');
    const pomodoroStartBtn = document.getElementById('pomodoro-start-btn');
    const pomodoroPauseBtn = document.getElementById('pomodoro-pause-btn');
    const pomodoroResetBtn = document.getElementById('pomodoro-reset-btn');
    const pomodoroStatus = document.getElementById('pomodoro-status');

    let currentFocusTask = null;
    let focusTimerIntervalId = null;

    // Pomodoro variables
    let pomodoroIntervalId = null;
    let pomodoroTimeLeft = 0;
    let isPomodoroRunning = false;
    let pomodoroPhase = 'work';
    let pomodoroCount = 0;
    let isAppReady = false;

    // Load all saved data (tasks and pomodoro state)
    const allSavedData = await window.electronAPI.getData();
    const initialTasks = allSavedData.tasks || [];
    initialTasks.forEach(task => createTaskElement(task));

    // Check for overdue tasks on startup
    const overdueTasks = initialTasks.filter(task => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return task.dueDate && new Date(task.dueDate) < today && !task.completed;
    });

    if (overdueTasks.length > 0) {
        const taskNames = overdueTasks.map(task => task.text).join(', ');
        alert(`以下のタスクの期日が過ぎています！\n\n${taskNames}`);
    }

    // Load pomodoro state from combined data
    const loadedPomodoroState = allSavedData.pomodoroState || {};
    workDurationInput.value = loadedPomodoroState.workDuration || 25;
    breakDurationInput.value = loadedPomodoroState.breakDuration || 5;
    pomodoroTimeLeft = loadedPomodoroState.timeLeft || (workDurationInput.value * 60);
    pomodoroPhase = loadedPomodoroState.phase || 'work';
    pomodoroCount = loadedPomodoroState.count || 0;
    isPomodoroRunning = loadedPomodoroState.isRunning || false;

    updatePomodoroDisplay();
    updatePomodoroStatus();
    if (isPomodoroRunning) {
        startPomodoroTimer();
    }

    isAppReady = true;

    addTaskBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTask();
        }
    });

    exitFocusBtn.addEventListener('click', exitFocusMode);

    // Pomodoro event listeners
    pomodoroStartBtn.addEventListener('click', startPomodoroTimer);
    pomodoroPauseBtn.addEventListener('click', pausePomodoroTimer);
    pomodoroResetBtn.addEventListener('click', resetPomodoroTimer);
    workDurationInput.addEventListener('change', () => {
        if (!isPomodoroRunning) {
            pomodoroTimeLeft = workDurationInput.value * 60;
            updatePomodoroDisplay();
        }
        saveAllData();
    });
    breakDurationInput.addEventListener('change', () => {
        saveAllData();
    });

    function addTask() {
        const taskText = taskInput.value.trim();
        const estimatedTime = parseInt(estimatedTimeInput.value) || 0;
        if (taskText === '') return;
        createTaskElement({ text: taskText, completed: false, priority: '低', timer: { elapsedTime: 0, isRunning: false }, checklist: [], dueDate: '', estimatedTime: estimatedTime });
        saveAllData();
        taskInput.value = '';
        estimatedTimeInput.value = '';
        taskInput.focus();
    }

    function createTaskElement(task) {
        task.timer = task.timer || { elapsedTime: 0, isRunning: false };
        task.checklist = task.checklist || [];
        task.dueDate = task.dueDate || '';
        task.estimatedTime = task.estimatedTime || 0;

        const li = document.createElement('li');
        li.dataset.task = JSON.stringify(task); // Store task data on the li element

        if (task.completed) {
            li.classList.add('completed');
        }
        li.classList.add(`priority-${task.priority}`);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (task.dueDate && new Date(task.dueDate) < today && !task.completed) {
            li.classList.add('overdue');
        }

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => {
            li.classList.toggle('completed');
            if (li.classList.contains('completed')) {
                li.classList.remove('overdue');
            } else if (task.dueDate && new Date(task.dueDate) < today) {
                li.classList.add('overdue');
            }
            updateTaskData(li, 'completed', li.classList.contains('completed'));
            saveAllData();
        });

        const span = document.createElement('span');
        span.textContent = task.text;
        span.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = span.textContent;
            li.replaceChild(input, span);
            input.focus();

            const saveEdit = () => {
                const newText = input.value.trim();
                span.textContent = newText;
                li.replaceChild(span, input);
                updateTaskData(li, 'text', newText);
                saveAllData();
            };

            input.addEventListener('blur', saveEdit);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    saveEdit();
                }
            });
        });

        const prioritySelect = document.createElement('select');
        prioritySelect.className = 'priority-select';
        ['高', '中', '低'].forEach(p => {
            const option = document.createElement('option');
            option.value = p;
            option.textContent = p;
            if (p === task.priority) {
                option.selected = true;
            }
            prioritySelect.appendChild(option);
        });
        prioritySelect.addEventListener('change', () => {
            li.classList.remove('priority-高', 'priority-中', 'priority-低');
            li.classList.add(`priority-${prioritySelect.value}`);
            updateTaskData(li, 'priority', prioritySelect.value);
            saveAllData();
        });

        const dueDateInput = document.createElement('input');
        dueDateInput.type = 'date';
        dueDateInput.className = 'due-date-input';
        dueDateInput.value = task.dueDate;
        dueDateInput.addEventListener('change', () => {
            const newDueDate = dueDateInput.value;
            updateTaskData(li, 'dueDate', newDueDate);
            if (newDueDate && new Date(newDueDate) < today && !task.completed) {
                li.classList.add('overdue');
            } else {
                li.classList.remove('overdue');
            }
            saveAllData();
        });

        const timerDisplay = document.createElement('span');
        timerDisplay.className = 'timer-display';
        timerDisplay.textContent = formatTime(task.timer.elapsedTime);

        const startBtn = document.createElement('button');
        startBtn.textContent = '開始';
        startBtn.className = 'timer-btn start-btn';

        const pauseBtn = document.createElement('button');
        pauseBtn.textContent = '一時停止';
        pauseBtn.className = 'timer-btn pause-btn';
        pauseBtn.style.display = 'none';

        const resetBtn = document.createElement('button');
        resetBtn.textContent = 'リセット';
        resetBtn.className = 'timer-btn reset-btn';

        let intervalId = null;
        let startTime = null;
        let currentElapsedTime = task.timer.elapsedTime;

        const updateTaskTimerDisplay = () => {
            timerDisplay.textContent = formatTime(currentElapsedTime);
            updateTimeDiff(task, timerDisplay, timeDiffDisplay); // Pass elements to updateTimeDiff
        };

        const startTimer = () => {
            if (intervalId) return;
            startTime = Date.now() - currentElapsedTime * 1000;
            intervalId = setInterval(() => {
                currentElapsedTime = Math.floor((Date.now() - startTime) / 1000);
                updateTaskTimerDisplay();
                updateTaskData(li, 'timer', { elapsedTime: currentElapsedTime, isRunning: true });
                saveAllData();
            }, 1000);
            startBtn.style.display = 'none';
            pauseBtn.style.display = 'inline-block';
            updateTaskData(li, 'timer', { elapsedTime: currentElapsedTime, isRunning: true });
            saveAllData();
        };

        const pauseTimer = () => {
            clearInterval(intervalId);
            intervalId = null;
            startBtn.style.display = 'inline-block';
            pauseBtn.style.display = 'none';
            updateTaskData(li, 'timer', { elapsedTime: currentElapsedTime, isRunning: false });
            saveAllData();
        };

        const resetTimer = () => {
            pauseTimer();
            currentElapsedTime = 0;
            updateTaskTimerDisplay();
            updateTaskData(li, 'timer', { elapsedTime: 0, isRunning: false });
            saveAllData();
        };

        startBtn.addEventListener('click', startTimer);
        pauseBtn.addEventListener('click', pauseTimer);
        resetBtn.addEventListener('click', resetTimer);

        if (task.timer.isRunning) {
            startTimer();
        }

        const focusBtn = document.createElement('button');
        focusBtn.textContent = '集中';
        focusBtn.className = 'focus-btn';
        focusBtn.addEventListener('click', () => enterFocusMode(task));

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '削除';
        deleteBtn.className = 'delete-btn';
        deleteBtn.addEventListener('click', () => {
            taskList.removeChild(li);
            clearInterval(intervalId);
            saveAllData();
        });

        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(prioritySelect);
        li.appendChild(dueDateInput);
        li.appendChild(timerDisplay);
        li.appendChild(startBtn);
        li.appendChild(pauseBtn);
        li.appendChild(resetBtn);
        li.appendChild(focusBtn);
        li.appendChild(deleteBtn);

        // Time difference display
        const timeDiffDisplay = document.createElement('span');
        timeDiffDisplay.className = 'time-diff';
        updateTimeDiff(task, timerDisplay, timeDiffDisplay); // Initial update
        li.appendChild(timeDiffDisplay);

        // --- Checklist Section ---
        const checklistContainer = document.createElement('div');
        checklistContainer.className = 'checklist-container';

        const checklistInput = document.createElement('input');
        checklistInput.type = 'text';
        checklistInput.placeholder = 'チェック項目を追加...';
        checklistInput.className = 'checklist-input';

        const addChecklistItemBtn = document.createElement('button');
        addChecklistItemBtn.textContent = '追加';
        addChecklistItemBtn.className = 'add-checklist-item-btn';

        const checklistUl = document.createElement('ul');
        checklistUl.className = 'checklist-ul';

        addChecklistItemBtn.addEventListener('click', () => {
            const itemText = checklistInput.value.trim();
            if (itemText === '') return;
            createChecklistItemElement({ text: itemText, completed: false }, checklistUl, li); // Pass parent li
            checklistInput.value = '';
            checklistInput.focus();
            saveAllData();
        });

        checklistInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addChecklistItemBtn.click();
            }
        });

        checklistContainer.appendChild(checklistInput);
        checklistContainer.appendChild(addChecklistItemBtn);
        checklistContainer.appendChild(checklistUl);

        // Render existing checklist items
        task.checklist.forEach(item => createChecklistItemElement(item, checklistUl, li)); // Pass parent li

        li.appendChild(checklistContainer);
        // --- End Checklist Section ---

        taskList.appendChild(li);
    }

    function createChecklistItemElement(item, parentUl, parentTaskLi) {
        const li = document.createElement('li');
        li.className = 'checklist-item';
        if (item.completed) {
            li.classList.add('completed');
        }

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = item.completed;
        checkbox.addEventListener('change', () => {
            li.classList.toggle('completed');
            updateChecklistItemData(parentTaskLi, item, 'completed', checkbox.checked);
            saveAllData();
        });

        const span = document.createElement('span');
        span.textContent = item.text;

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'x';
        deleteBtn.className = 'delete-checklist-item-btn';
        deleteBtn.addEventListener('click', () => {
            parentUl.removeChild(li);
            removeChecklistItemData(parentTaskLi, item);
            saveAllData();
        });

        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(deleteBtn);
        parentUl.appendChild(li);
    }

    function formatTime(seconds) {
        const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
        const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
        const s = String(seconds % 60).padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    function parseTime(timeString) {
        const parts = timeString.split(':').map(Number);
        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        return 0;
    }

    function updateTimeDiff(task, timerDisplay, timeDiffDisplay) {
        const diff = task.estimatedTime * 60 - parseTime(timerDisplay.textContent);
        const sign = diff >= 0 ? '+' : '-';
        const absDiff = Math.abs(diff);
        const h = String(Math.floor(absDiff / 3600)).padStart(2, '0');
        const m = String(Math.floor((absDiff % 3600) / 60)).padStart(2, '0');
        const s = String(absDiff % 60).padStart(2, '0');
        timeDiffDisplay.textContent = `${sign}${h}:${m}:${s}`;

        if (diff < 0) {
            timeDiffDisplay.classList.add('over');
            timeDiffDisplay.classList.remove('under');
        } else if (diff > 0) {
            timeDiffDisplay.classList.add('under');
            timeDiffDisplay.classList.remove('over');
        } else {
            timeDiffDisplay.classList.remove('over', 'under');
        }
    }

    function enterFocusMode(task) {
        normalView.style.display = 'none';
        focusView.style.display = 'flex';

        currentFocusTask = task;
        focusTaskTitle.textContent = task.text;
        focusTimerDisplay.textContent = formatTime(task.timer.elapsedTime);

        let focusElapsedTime = task.timer.elapsedTime;
        let focusStartTime = null;

        const updateFocusTimerDisplay = () => {
            focusTimerDisplay.textContent = formatTime(focusElapsedTime);
        };

        const startFocusTimer = () => {
            if (focusTimerIntervalId) return;
            focusStartTime = Date.now() - focusElapsedTime * 1000;
            focusTimerIntervalId = setInterval(() => {
                focusElapsedTime = Math.floor((Date.now() - focusStartTime) / 1000);
                updateFocusTimerDisplay();
                currentFocusTask.timer.elapsedTime = focusElapsedTime;
                currentFocusTask.timer.isRunning = true;
                saveAllData();
            }, 1000);
            focusStartBtn.style.display = 'none';
            focusPauseBtn.style.display = 'inline-block';
        };

        const pauseFocusTimer = () => {
            clearInterval(focusTimerIntervalId);
            focusTimerIntervalId = null;
            focusStartBtn.style.display = 'inline-block';
            focusPauseBtn.style.display = 'none';
            currentFocusTask.timer.isRunning = false;
            saveAllData();
        };

        const resetFocusTimer = () => {
            pauseFocusTimer();
            focusElapsedTime = 0;
            updateFocusTimerDisplay();
            currentFocusTask.timer.elapsedTime = 0;
            saveAllData();
        };

        focusStartBtn.onclick = startFocusTimer;
        focusPauseBtn.onclick = pauseFocusTimer;
        focusResetBtn.onclick = resetFocusTimer;

        if (currentFocusTask.timer.isRunning) {
            startFocusTimer();
        } else {
            focusStartBtn.style.display = 'inline-block';
            focusPauseBtn.style.display = 'none';
        }
    }

    function exitFocusMode() {
        if (focusTimerIntervalId) {
            clearInterval(focusTimerIntervalId);
            focusTimerIntervalId = null;
        }
        if (currentFocusTask) {
            saveAllData();
        }

        normalView.style.display = 'block';
        focusView.style.display = 'none';
        currentFocusTask = null;
    }

    function startPomodoroTimer() {
        if (pomodoroIntervalId) return;

        isPomodoroRunning = true;
        pomodoroStartBtn.style.display = 'none';
        pomodoroPauseBtn.style.display = 'inline-block';

        pomodoroIntervalId = setInterval(() => {
            pomodoroTimeLeft--;
            updatePomodoroDisplay();
            saveAllData();

            if (pomodoroTimeLeft <= 0) {
                clearInterval(pomodoroIntervalId);
                pomodoroIntervalId = null;
                isPomodoroRunning = false;

                if (pomodoroPhase === 'work') {
                    pomodoroCount++;
                    if (pomodoroCount % 4 === 0) {
                        pomodoroPhase = 'long-break';
                        pomodoroTimeLeft = breakDurationInput.value * 60 * 2;
                        pomodoroStatus.textContent = '長い休憩中...';
                    } else {
                        pomodoroPhase = 'break';
                        pomodoroTimeLeft = breakDurationInput.value * 60;
                        pomodoroStatus.textContent = '休憩中...';
                    }
                } else {
                    pomodoroPhase = 'work';
                    pomodoroTimeLeft = workDurationInput.value * 60;
                    pomodoroStatus.textContent = '作業中...';
                }
                updatePomodoroDisplay();
                saveAllData();
                startPomodoroTimer();
            }
        }, 1000);
        updatePomodoroStatus();
        saveAllData();
    }

    function pausePomodoroTimer() {
        clearInterval(pomodoroIntervalId);
        pomodoroIntervalId = null;
        isPomodoroRunning = false;
        pomodoroStartBtn.style.display = 'inline-block';
        pomodoroPauseBtn.style.display = 'none';
        saveAllData();
    }

    function resetPomodoroTimer() {
        clearInterval(pomodoroIntervalId);
        pomodoroIntervalId = null;
        isPomodoroRunning = false;
        pomodoroPhase = 'work';
        pomodoroCount = 0;
        pomodoroTimeLeft = workDurationInput.value * 60;
        updatePomodoroDisplay();
        updatePomodoroStatus();
        pomodoroStartBtn.style.display = 'inline-block';
        pomodoroPauseBtn.style.display = 'none';
        saveAllData();
    }

    function updatePomodoroDisplay() {
        pomodoroDisplay.textContent = formatTime(pomodoroTimeLeft);
    }

    function updatePomodoroStatus() {
        if (isPomodoroRunning) {
            pomodoroStatus.textContent = `${pomodoroPhase === 'work' ? '作業中' : '休憩中'} (${pomodoroCount} ポモドーロ)`;
        } else {
            pomodoroStatus.textContent = '準備完了';
        }
    }

    // Helper function to update task data stored on the li element
    function updateTaskData(liElement, key, value) {
        const taskData = JSON.parse(liElement.dataset.task);
        taskData[key] = value;
        liElement.dataset.task = JSON.stringify(taskData);
    }

    // Helper function to update checklist item data stored on the parent task li element
    function updateChecklistItemData(parentTaskLi, itemToUpdate, key, value) {
        const taskData = JSON.parse(parentTaskLi.dataset.task);
        const checklist = taskData.checklist;
        const itemIndex = checklist.findIndex(item => item.text === itemToUpdate.text); // Simple match for now
        if (itemIndex !== -1) {
            checklist[itemIndex][key] = value;
            parentTaskLi.dataset.task = JSON.stringify(taskData);
        }
    }

    // Helper function to remove checklist item data from the parent task li element
    function removeChecklistItemData(parentTaskLi, itemToRemove) {
        const taskData = JSON.parse(parentTaskLi.dataset.task);
        taskData.checklist = taskData.checklist.filter(item => item.text !== itemToRemove.text); // Simple match for now
        parentTaskLi.dataset.task = JSON.stringify(taskData);
    }

    // This function now saves both tasks and pomodoro state
    function saveAllData() {
        if (!isAppReady) return;

        const tasks = [];
        document.querySelectorAll('#task-list > li').forEach(li => {
            tasks.push(JSON.parse(li.dataset.task)); // Get task data directly from li element
        });

        const pomodoroState = {
            workDuration: parseInt(workDurationInput.value),
            breakDuration: parseInt(breakDurationInput.value),
            timeLeft: pomodoroTimeLeft,
            phase: pomodoroPhase,
            count: pomodoroCount,
            isRunning: isPomodoroRunning
        };
        
        window.electronAPI.setData({ tasks: tasks, pomodoroState: pomodoroState });
    }
});
