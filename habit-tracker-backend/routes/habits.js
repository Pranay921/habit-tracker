const express = require('express');
const auth = require('../middleware/auth');
const Habit = require('../models/Habit');
const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// Get all habits for a user
router.get('/', async (req, res) => {
  try {
    const habits = await Habit.find({ userId: req.user._id });
    res.json(habits);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching habits', error: error.message });
  }
});

// Create new habit
router.post('/', async (req, res) => {
  try {
    const { name, description, time, frequency, reminder } = req.body;
    
    const habit = new Habit({
      userId: req.user._id,
      name,
      description,
      time,
      frequency,
      reminder
    });
    
    await habit.save();
    res.status(201).json(habit);
  } catch (error) {
    res.status(500).json({ message: 'Error creating habit', error: error.message });
  }
});

// Update habit
router.put('/:id', async (req, res) => {
  try {
    const updatedData = req.body;
    const habit = await Habit.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updatedData,
      { new: true }
    );
    
    if (!habit) {
      return res.status(404).json({ message: 'Habit not found' });
    }
    
    res.json(habit);
  } catch (error) {
    res.status(500).json({ message: 'Error updating habit', error: error.message });
  }
});

// Delete habit
router.delete('/:id', async (req, res) => {
  try {
    const habit = await Habit.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    
    if (!habit) {
      return res.status(404).json({ message: 'Habit not found' });
    }
    
    res.json({ message: 'Habit deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting habit', error: error.message });
  }
});

// Mark habit as complete
router.post('/:id/complete', async (req, res) => {
  try {
    const habit = await Habit.findOne({ _id: req.params.id, userId: req.user._id });
    
    if (!habit) {
      return res.status(404).json({ message: 'Habit not found' });
    }
    
    // Use model method to mark as complete and recalculate streak
    const updatedHabit = await habit.markComplete();
    res.json(updatedHabit);
  } catch (error) {
    res.status(500).json({ message: 'Error completing habit', error: error.message });
  }
});

module.exports = router;