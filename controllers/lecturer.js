const mongoose = require("mongoose");
const { Lecturer } = require("../Models/lecturer");
const { Attendance } = require("../Models/attendance");
const { Course } = require("../Models/course");
const { Student } = require("../Models/student");
const { ReadConcern } = require("mongodb");
const { use } = require("../routes/student");
const { json } = require("body-parser");

async function login(req, res) {
  console.log("Lecturer login ...");

  const { email, password } = req.body;

  if (!email || !password)
    return res.status(401).send("Include email and password in request body !");

  try {
    const user = await Lecturer.findOne({
      email,
      password,
    });

    if (!user) res.status(404).send(`Login Failed !!`);
    else {
      // Login succesfull, Sending the ID
      console.log("Login Successful ", user._id);
      res.status(201).send(user._id);
    }
  } catch (e) {
    res.status(501).send(`Error: ${e}`);
  }
}

async function register(req, res) {
  console.log("Registering Lecturer ...");

  const { lecturerID, name, email, phone, password, courses } = req.body;

  if (!email || !name || !phone || !lecturerID || !password)
    return res
      .status(401)
      .send(
        "Include valid name, email, password, phone number and lecturerID within request body"
      );

  try {
    await new Lecturer({
      lecturerID,
      name,
      email,
      phone,
      password,
    }).save();

    res.status(200).send("Registration Successful");
  } catch (e) {
    res.status(501).send(`User already Exists`);
  }
}

async function get_courses(req, res) {
  const { key } = req.body;

  // key = JSON.stringify(key);

  if (!key) return res.status(401).send("Include key in request body !");

  let AllCourses = [];
  try {
    const user = await Lecturer.findOne({
      _id: key,
    });
    if (!user) return res.status(404).send("Lecturer not found !!!");

    if (user.courses == null) return res.status(200).send("No courses Yet");

    for (eachCourse of user.courses) {
      console.log("eachCourse \n" + eachCourse);

      try {
        const courseDetails = await Course.find({
          _id: eachCourse,
        });

        AllCourses.push(courseDetails);
      } catch (e) {
        res.status(502).send(`Error ${e}`);
      }
    }

    return res.status(200).send(AllCourses);
  } catch (e) {
    return res.status(501).send(`Error: ${e}`);
  }
}

async function add_course(req, res) {
  const { key, name, courseCode } = req.body;

  console.log(key + "\n" + name + "\n" + courseCode);

  if (!key || !name || !courseCode)
    return res.status(401).send("Include key and courseName");

  // check if course already exists
  try {
    const course = await Course.findOne({
      name,
      courseCode,
    });

    if (course) return res.status(201).send(`course already exists`);
  } catch (e) {
    return res.status(501).send(`Error : ${e}`);
  }

  // course doesnt exists and creating it now
  try {
    await new Course({
      name,
      courseCode,
    }).save();

    // finding the course form course coll
    try {
      const newCourse = await Course.findOne({
        name,
        courseCode,
      });

      console.log("Reach 1 \n" + newCourse);

      // updating the course in lecture coll
      try {
        await Lecturer.updateOne(
          {
            _id: key,
          },
          {
            $push: {
              courses: newCourse,
            },
          }
        );
      } catch (e) {
        return res.status(501).send(`Error ${e}`);
      }
    } catch (e) {
      return res.status(501).send(`Error : ${e}`);
    }

    res
      .status(200)
      .send(
        `[+] course created sucessfully and [+] updated into lectures courses `
      );
  } catch (e) {
    return res.status(501).send(`Error : ${e}`);
  }
}

async function add_attendance(req, res) {
  // {
  //   "key": "6397406b66f300fac7b1a947",
  //     "dateString": "12122022",
  //     "course": "19CS6PCCNS",
  //     "attendances": [
  //   {
  //     "student": "1BM19CS101",
  //     "attendance": true
  //   }
  // ]
  // }

  let { key, attendances, dateString, course } = req.body;

  // console.log("key \n" + key);

  if (!key || !attendances || !dateString || !course)
    return res
      .status(401)
      .send(
        "Include key, course, dateString and attendance array in request body !"
      );

  const uniqu_id = dateString + "-" + course;
  console.log("uniqu_id\n" + uniqu_id);

  const course_exists = await Course.findOne({ name: course });

  if (!course_exists) return res.status(404).send("Invalid course !");

  const attendance_exists = await Attendance.findOne({
    uniqu_id,
  });

  if (attendance_exists)
    return res.status(403).send(`Cant have Duplicate Attendance`);

  for (const entry of attendances) {
    console.log("entry \n" + entry);

    // checks for the student
    const student_exists = await Student.findOne({ usn: entry.student });
    console.log(student_exists);

    // if we find enrty of student who hasn't been registerd yet
    if (!student_exists) continue;

    const attendance_table = await Attendance.findOne({
      uniqu_id,
    });

    // once the attendance for the particular date and course
    // has been created, this below code gets executed
    if (attendance_table) {
      try {
        await Attendance.updateOne(
          { uniqu_id },
          {
            $push: {
              students: {
                usn: student_exists.usn,
                present: entry.attendance,
              },
            },
          }
        );
      } catch (e) {
        console.log(e);
        return res.status(401).send(`cant update the same `);
      }
    }

    // first time adding the attendace data
    // works for the first entry of the student's data
    else if (!attendance_table) {
      try {
        await new Attendance({
          uniqu_id,
          dateString,
          course: course_exists._id,
          students: [
            {
              usn: student_exists.usn,
              present: entry.attendance,
            },
          ],
        }).save();
      } catch (e) {
        console.log(e);
        return res.status(402).send(`cant update the same `);
      }
    }
  }
  return res.status(200).send("Attendance updated !");
}

async function get_attendance(req, res) {
  const { courseName } = req.body;

  if (!courseName) return res.status(401).send(`Invalid key and name`);

  let course;
  try {
    course = await Course.findOne({
      name: courseName,
    });
  } catch (e) {
    return res.status(501).send(`Error 1 : ${e}`);
  }

  console.log("course \n" + course);

  if (!course) return res.status(401).send(`Error : Course dosent Exists`);

  let Course_Attendance;
  try {
    Course_Attendance = await Attendance.find(
      {
        course: course._id,
      },
      {
        // students: 1,
      }
    );
  } catch (e) {
    return res.status(501).send(`Error : ${e}`);
  }

  console.log("Course_Attendance \n" + Course_Attendance);

  let Course_Students;
  try {
    Course_Students = await Student.find({
      courses: { $in: course._id },
    });

    console.log("Course_Students \n" + Course_Students);

    let TotalClasses = Course_Attendance.length;
    let All_Students_Data = [];

    for (const EachStudent of Course_Students) {
      let present = 0;

      for (EachDay of Course_Attendance) {
        for (EachEntry of EachDay.students) {
          if (EachStudent.usn == EachEntry.usn && EachEntry.present) {
            present++;
          }
        }
      }

      let EachStudentData = {
        name: EachStudent.name,
        usn: EachStudent.usn,
        Attendance: (present / TotalClasses) * 100,
        AttendedClasses: present,
        TotalClasses: TotalClasses,
      };

      All_Students_Data.push(EachStudentData);
    }

    // console.log("All_Students_Data\n" + All_Students_Data);

    return res.status(201).send({ All_Students_Data });
  } catch (e) {
    return res.status(501).send(`Error ${e}`);
  }
}

async function delete_course(req, res) {
  const { courseName } = req.body;

  let course;
  try {
    course = await Course.findOne({ name: courseName });
  } catch (e) {
    return res.status(501).send(`Error ${e}`);
  }

  if (!course) return res.status(401).send(`Course Doesnt Exist`);

  try {
    await Student.updateMany(
      {
        courses: { $in: course._id },
      },
      {
        $pull: { courses: course._id },
      }
    );
  } catch (e) {
    return res.status(401).send(`Error ${e}`);
  }

  try {
    await Lecturer.updateOne(
      {
        courses: { $in: course._id },
      },
      {
        $pull: { courses: course._id },
      }
    );
  } catch (e) {
    return res.status(402).send(`Error ${e}`);
  }

  try {
    await Course.deleteOne({
      _id: course._id,
    });
  } catch (e) {
    return res.status(403).send(`Error ${e}`);
  }

  return res.status(201).send(`Successfully Deleted !`);
}

module.exports = {
  login,
  register,
  get_courses,
  add_attendance,
  add_course,
  get_attendance,
  delete_course,
};
