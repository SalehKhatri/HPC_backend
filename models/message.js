const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
    senderId: {
        type: String,  // Corrected type from string to String
        required: 'sender is required',
    },
    receiverId: {
        type: String,
        required: 'reciver is required',
    },
    message: {
        type: String,
        required: 'message is required',
    }
}, {
    timestamps: true
});

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
