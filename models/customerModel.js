const mongoose=require ('mongoose')
const customerSchema = new mongoose.Schema({
    userId:{type: mongoose.Schema.Types.ObjectId,ref:'User',unique:true},
    fullName:{type:String ,required:true},
    phone:     { type: String },
    address:   { type: String },
    governate: { type: String },
    city:      { type: String },
},{timestamps:true})
module.exports = mongoose.model('Customer', customerSchema);

