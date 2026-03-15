
function setupSheets(){

var ss=SpreadsheetApp.getActive()

var db=ss.insertSheet("قاعدة_البيانات")
var accounts=ss.insertSheet("الحسابات")

db.appendRow(["التاريخ","العملية","الحساب","الوزن","الكثافة","السعر"])
accounts.appendRow(["اسم الحساب","نوع الحساب","الرصيد"])

}
