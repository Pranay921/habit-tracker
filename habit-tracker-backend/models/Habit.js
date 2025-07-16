const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  time: {
    type: String,
    enum: ['morning', 'afternoon', 'evening', 'night'],
    required: true
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekdays', 'weekends', 'custom'],
    required: true
  },
  reminder: {
    type: Boolean,
    default: false
  },
  streak: {
    type: Number,
    default: 0
  },
  completed: {
    type: Map,
    of: Boolean,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Helper to format a Date object to 'YYYY-MM-DD'
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Mark a habit as complete for a given date (defaults to today),
 // then recalculate the streak.
habitSchema.methods.markComplete = function(date = new Date()) {
  const dateStr = formatDate(date);
  this.completed.set(dateStr, true);
  this.calculateStreak();
  return this.save();
};

// Calculate the current consecutive-day streak based on the completed map.
habitSchema.methods.calculateStreak = function() {
  let streakCount = 0;
  // Start from today
  let currentDate = new Date(formatDate(new Date()));
  while (true) {
    const dateStr = formatDate(currentDate);
    if (this.completed.get(dateStr)) {
      streakCount++;
      // Move to previous day
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }
  this.streak = streakCount;
  return this.streak;
};

// Get all dates on which the habit was completed.
habitSchema.methods.getCompletionDates = function() {
  return Array.from(this.completed.entries())
    .filter(([_, completed]) => completed)
    .map(([dateStr, _]) => dateStr);
};

module.exports = mongoose.model('Habit', habitSchema);