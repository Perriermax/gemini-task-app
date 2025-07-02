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
    const taskOverviewList = document.getElementById('task-overview-list'); // Renamed from taskList
    const todayTaskList = document.getElementById('today-task-list');

    // Date navigation elements
    const prevDayBtn = document.getElementById('prev-day-btn');
    const nextDayBtn = document.getElementById('next-day-btn');
    const todayDateDisplay = document.getElementById('today-date-display');

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

    // Declare today here, accessible by all functions within this scope
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Date variables for navigation
    let currentViewDate = new Date();
    currentViewDate.setHours(0, 0, 0, 0);

    // Load all saved data (tasks and pomodoro state)
    const allSavedData = await window.electronAPI.getData();
    let allTasks = allSavedData.tasks || []; // Use a mutable variable for all tasks

    // Render tasks initially
    renderAllTasks();

    // Check for overdue tasks on startup
    const overdueTasks = allTasks.filter(task => {
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

    // Initial check for column display
    updateColumnDisplay();

    // Listen for window resize events
    window.addEventListener('resize', updateColumnDisplay);

    addTaskBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTask();
        }
    });

    exitFocusBtn.addEventListener('click', exitFocusMode);

    // Date navigation event listeners
    prevDayBtn.addEventListener('click', () => {
        currentViewDate.setDate(currentViewDate.getDate() - 1);
        renderAllTasks();
    });
    nextDayBtn.addEventListener('click', () => {
        currentViewDate.setDate(currentViewDate.getDate() + 1);
        renderAllTasks();
    });

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
        const newTask = { text: taskText, completed: false, priority: '低', timer: { elapsedTime: 0, isRunning: false }, checklist: [], dueDate: '', estimatedTime: estimatedTime };
        allTasks.push(newTask);
        renderAllTasks(); // Re-render all tasks to place the new task correctly
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
        li.dataset.taskId = task.id || generateUniqueId();
        task.id = li.dataset.taskId;
        li.dataset.task = JSON.stringify(task);
        li.draggable = true; // Make task items draggable

        // Drag and Drop Event Listeners
        li.addEventListener('dragstart', (e) => {
            draggedItem = li;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', li.innerHTML);
            li.classList.add('dragging');
        });

        li.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow dropping
            const bounding = li.getBoundingClientRect();
            const offset = bounding.y + (bounding.height / 2);
            if (e.clientY < offset) {
                li.classList.add('drag-over-top');
                li.classList.remove('drag-over-bottom');
            } else {
                li.classList.add('drag-over-bottom');
                li.classList.remove('drag-over-top');
            }
        });

        li.addEventListener('dragleave', () => {
            li.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        li.addEventListener('drop', (e) => {
            e.preventDefault();
            li.classList.remove('drag-over-top', 'drag-over-bottom');

            if (draggedItem === li) return; // Dropping on itself

            const parentList = li.parentNode;
            const draggedIndex = Array.from(parentList.children).indexOf(draggedItem);
            const targetIndex = Array.from(parentList.children).indexOf(li);

            // Reorder in DOM
            if (li.classList.contains('drag-over-top')) {
                parentList.insertBefore(draggedItem, li);
            } else {
                parentList.insertBefore(draggedItem, li.nextSibling);
            }

            // If dropped into today-task-list, update dueDate
            if (parentList.id === 'today-task-list') {
                const draggedTaskData = allTasks.find(t => t.id === draggedItem.dataset.taskId);
                if (draggedTaskData) {
                    // Format currentViewDate to YYYY-MM-DD for dueDate
                    const year = currentViewDate.getFullYear();
                    const month = String(currentViewDate.getMonth() + 1).padStart(2, '0');
                    const day = String(currentViewDate.getDate()).padStart(2, '0');
                    draggedTaskData.dueDate = `${year}-${month}-${day}`;
                }
            }

            // Reorder in allTasks array
            const draggedTask = allTasks.find(t => t.id === draggedItem.dataset.taskId);
            const targetTask = allTasks.find(t => t.id === li.dataset.taskId);

            const oldIndex = allTasks.indexOf(draggedTask);
            const newIndex = allTasks.indexOf(targetTask);

            if (oldIndex > -1 && newIndex > -1) {
                allTasks.splice(oldIndex, 1);
                allTasks.splice(newIndex, 0, draggedTask);
            }
            renderAllTasks(); // Re-render to reflect due date change and reordering
            saveAllData();
        });

        li.addEventListener('dragend', () => {
            draggedItem.classList.remove('dragging');
            document.querySelectorAll('.drag-over-top', '.drag-over-bottom').forEach(el => {
                el.classList.remove('drag-over-top', 'drag-over-bottom');
            });
            draggedItem = null;
            saveAllData();
        });

        if (task.completed) {
            li.classList.add('completed');
        }
        li.classList.add(`priority-${task.priority}`);

        // Add class for overdue tasks
        // Use the 'today' variable from the outer scope
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
            updateTaskData(li.dataset.taskId, 'completed', li.classList.contains('completed'));
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
                updateTaskData(li.dataset.taskId, 'text', newText);
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
            updateTaskData(li.dataset.taskId, 'priority', prioritySelect.value);
            saveAllData();
        });

        const dueDateInput = document.createElement('input');
        dueDateInput.type = 'date';
        dueDateInput.className = 'due-date-input';
        dueDateInput.value = task.dueDate;
        dueDateInput.addEventListener('change', () => {
            const newDueDate = dueDateInput.value;
            updateTaskData(li.dataset.taskId, 'dueDate', newDueDate);
            // Re-render all tasks to move to correct list if due date changes
            renderAllTasks();
            saveAllData();
        });

        const clearDueDateBtn = document.createElement('button');
        clearDueDateBtn.textContent = 'クリア';
        clearDueDateBtn.className = 'clear-due-date-btn';
        clearDueDateBtn.addEventListener('click', () => {
            dueDateInput.value = '';
            updateTaskData(li.dataset.taskId, 'dueDate', '');
            renderAllTasks();
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

        const startTimer = () => {
            if (intervalId) return;
            startTime = Date.now() - currentElapsedTime * 1000;
            intervalId = setInterval(() => {
                currentElapsedTime = Math.floor((Date.now() - startTime) / 1000);
                timerDisplay.textContent = formatTime(currentElapsedTime);
                updateTimeDiff(task, timerDisplay, timeDiffDisplay); // Call updateTimeDiff directly
                updateTaskData(li.dataset.taskId, 'timer', { elapsedTime: currentElapsedTime, isRunning: true });
                saveAllData();
            }, 1000);
            startBtn.style.display = 'none';
            pauseBtn.style.display = 'inline-block';
            updateTaskData(li.dataset.taskId, 'timer', { elapsedTime: currentElapsedTime, isRunning: true });
            saveAllData();
        };

        const pauseTimer = () => {
            clearInterval(intervalId);
            intervalId = null;
            startBtn.style.display = 'inline-block';
            pauseBtn.style.display = 'none';
            updateTaskData(li.dataset.taskId, 'timer', { elapsedTime: currentElapsedTime, isRunning: false });
            saveAllData();
        };

        const resetTimer = () => {
            pauseTimer();
            currentElapsedTime = 0;
            timerDisplay.textContent = formatTime(currentElapsedTime);
            updateTimeDiff(task, timerDisplay, timeDiffDisplay); // Call updateTimeDiff directly
            updateTaskData(li.dataset.taskId, 'timer', { elapsedTime: 0, isRunning: false });
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
            // Remove task from allTasks array
            allTasks = allTasks.filter(t => t.id !== task.id);
            li.remove(); // Remove from DOM
            clearInterval(intervalId);
            saveAllData();
        });

        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(prioritySelect);
        li.appendChild(dueDateInput);
        li.appendChild(clearDueDateBtn); // Add clear due date button
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
            const newChecklistItem = { text: itemText, completed: false };
            createChecklistItemElement(newChecklistItem, checklistUl, li); // Pass parent li
            // Update task data in allTasks array
            const taskToUpdate = allTasks.find(t => t.id === task.id);
            if (taskToUpdate) {
                taskToUpdate.checklist.push(newChecklistItem);
            }
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

        // Append to correct list based on due date
        const taskDueDate = task.dueDate ? new Date(task.dueDate) : null;
        if (taskDueDate && taskDueDate.setHours(0,0,0,0) === currentViewDate.getTime()) {
            todayTaskList.appendChild(li);
        } else if (taskDueDate && taskDueDate < currentViewDate && !task.completed) { // Overdue and incomplete
            todayTaskList.appendChild(li);
        }else {
            taskOverviewList.appendChild(li);
        }
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
            updateChecklistItemData(parentTaskLi.dataset.taskId, item, 'completed', checkbox.checked);
            saveAllData();
        });

        const span = document.createElement('span');
        span.textContent = item.text;

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'x';
        deleteBtn.className = 'delete-checklist-item-btn';
        deleteBtn.addEventListener('click', () => {
            parentUl.removeChild(li);
            removeChecklistItemData(parentTaskLi.dataset.taskId, item);
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
    function updateTaskData(taskId, key, value) {
        const taskIndex = allTasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            allTasks[taskIndex][key] = value;
        }
    }

    // Helper function to update checklist item data stored on the parent task li element
    function updateChecklistItemData(parentTaskId, itemToUpdate, key, value) {
        const parentTask = allTasks.find(t => t.id === parentTaskId);
        if (parentTask) {
            const itemIndex = parentTask.checklist.findIndex(item => item.text === itemToUpdate.text); // Simple match for now
            if (itemIndex !== -1) {
                parentTask.checklist[itemIndex][key] = value;
            }
        }
    }

    // Helper function to remove checklist item data from the parent task li element
    function removeChecklistItemData(parentTaskId, itemToRemove) {
        const parentTask = allTasks.find(t => t.id === parentTaskId);
        if (parentTask) {
            parentTask.checklist = parentTask.checklist.filter(item => item.text !== itemToRemove.text); // Simple match for now
        }
    }

    // This function now saves both tasks and pomodoro state
    function saveAllData() {
        if (!isAppReady) return;

        const pomodoroState = {
            workDuration: parseInt(workDurationInput.value),
            breakDuration: parseInt(breakDurationInput.value),
            timeLeft: pomodoroTimeLeft,
            phase: pomodoroPhase,
            count: pomodoroCount,
            isRunning: isPomodoroRunning
        };
        
        window.electronAPI.setData({ tasks: allTasks, pomodoroState: pomodoroState });
    }

    // Function to re-render all tasks based on current data
    function renderAllTasks() {
        // Clear existing tasks from both lists
        taskOverviewList.innerHTML = '';
        todayTaskList.innerHTML = '';

        // Update today's date display
        todayDateDisplay.textContent = currentViewDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

        // Re-create elements for each task
        allTasks.forEach(task => createTaskElement(task));
    }

    // Function to update column display based on window width
    function updateColumnDisplay() {
        const taskColumns = document.querySelector('.task-columns');
        if (window.innerWidth < 900) { // Example breakpoint
            taskColumns.classList.add('single-column');
        } else {
            taskColumns.classList.remove('single-column');
        }
    }

    // Simple unique ID generator
    function generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
});
