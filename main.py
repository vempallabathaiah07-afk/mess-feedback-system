import os
import json
import sqlite3
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Mess Menu Feedback API")

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    DB_PATH = os.environ.get("DB_PATH", "/tmp/mess_feedback.db")
else:
    DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "mess_feedback.db"))


# Database helper functions
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        # Create menu table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS menu (
                day TEXT,
                meal TEXT,
                items TEXT,
                PRIMARY KEY (day, meal)
            )
        """)
        
        # Create feedback table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reg TEXT,
                name TEXT,
                dept TEXT,
                week_key TEXT,
                day TEXT,
                meal TEXT,
                item TEXT,
                rating TEXT,
                UNIQUE(reg, week_key, day, meal, item) ON CONFLICT REPLACE
            )
        """)
        
        # Insert default menu if empty
        cursor = conn.execute("SELECT COUNT(*) as count FROM menu")
        if cursor.fetchone()["count"] == 0:
            default_menu = {
                'Sunday': { 'Breakfast': ['Poori', 'Kurma', 'Boiled Egg'], 'Lunch': ['Biryani', 'Raita'], 'Dinner': ['Pasta', 'Garlic Bread'] },
                'Monday': { 'Breakfast': ['Omelette', 'Toast'], 'Lunch': ['Biryani', 'Salad'], 'Dinner': ['Grilled Fish', 'Rice'] },
                'Tuesday': { 'Breakfast': ['Idli', 'Sambar'], 'Lunch': ['Butter Chicken', 'Naan'], 'Dinner': ['Noodles', 'Manchurian'] },
                'Wednesday': { 'Breakfast': ['Cereal', 'Milk'], 'Lunch': ['Thai Curry', 'Rice'], 'Dinner': ['Steak', 'Mashed Potatoes'] },
                'Thursday': { 'Breakfast': ['Scrambled Eggs', 'Sausage'], 'Lunch': ['Sushi', 'Miso Soup'], 'Dinner': ['Pizza', 'Garlic Bread'] },
                'Friday': { 'Breakfast': ['Bagel', 'Cream Cheese'], 'Lunch': ['Burger', 'Fries'], 'Dinner': ['Tacos', 'Salsa'] },
                'Saturday': { 'Breakfast': ['French Toast', 'Syrup'], 'Lunch': ['BBQ Ribs', 'Coleslaw'], 'Dinner': ['Salmon', 'Asparagus'] }
            }
            for day, meals in default_menu.items():
                for meal, items in meals.items():
                    conn.execute(
                        "INSERT INTO menu (day, meal, items) VALUES (?, ?, ?)",
                        (day, meal, json.dumps(items))
                    )
            conn.commit()

# Initialize Database
init_db()

# Pydantic models for request validation
class FeedbackSubmit(BaseModel):
    name: str
    dept: str
    week_key: str
    # feedback_data maps day -> meal -> item -> rating
    feedback_data: Dict[str, Dict[str, Dict[str, str]]]

# --- static assets routes ---
@app.get("/", response_class=HTMLResponse)
def read_index():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

@app.get("/style.css")
def read_css():
    return FileResponse(os.path.join(BASE_DIR, "style.css"))

@app.get("/app.js")
def read_js():
    return FileResponse(os.path.join(BASE_DIR, "app.js"))


# --- API Endpoints ---

@app.get("/api/menu")
def get_menu():
    with get_db() as conn:
        cursor = conn.execute("SELECT day, meal, items FROM menu")
        rows = cursor.fetchall()
    
    menu = {}
    for row in rows:
        day = row["day"]
        meal = row["meal"]
        items = json.loads(row["items"])
        if day not in menu:
            menu[day] = {}
        menu[day][meal] = items
    return menu

@app.post("/api/menu")
def save_menu(menu_data: Dict[str, Dict[str, List[str]]]):
    with get_db() as conn:
        conn.execute("DELETE FROM menu")
        for day, meals in menu_data.items():
            for meal, items in meals.items():
                conn.execute(
                    "INSERT INTO menu (day, meal, items) VALUES (?, ?, ?)",
                    (day, meal, json.dumps(items))
                )
        conn.commit()
    return {"status": "success", "message": "Menu updated successfully"}

@app.get("/api/feedback")
def get_feedback(dept: Optional[str] = "all"):
    query = "SELECT reg, name, dept, week_key, day, meal, item, rating FROM feedback"
    params = []
    if dept and dept != "all":
        query += " WHERE dept = ?"
        params.append(dept)
        
    with get_db() as conn:
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        
    # Reconstruct student nested feedback structure matching frontend expectations
    # allFeedback structure: { reg: { name, dept, weeks: { weekKey: { day: { meal: { item: rating } } } } } }
    feedback_dict = {}
    for row in rows:
        reg = row["reg"]
        name = row["name"]
        row_dept = row["dept"]
        week_key = row["week_key"]
        day = row["day"]
        meal = row["meal"]
        item = row["item"]
        rating = row["rating"]
        
        if reg not in feedback_dict:
            feedback_dict[reg] = {
                "name": name,
                "dept": row_dept,
                "weeks": {}
            }
        
        if week_key not in feedback_dict[reg]["weeks"]:
            feedback_dict[reg]["weeks"][week_key] = {}
            
        if day not in feedback_dict[reg]["weeks"][week_key]:
            feedback_dict[reg]["weeks"][week_key][day] = {}
            
        if meal not in feedback_dict[reg]["weeks"][week_key][day]:
            feedback_dict[reg]["weeks"][week_key][day][meal] = {}
            
        feedback_dict[reg]["weeks"][week_key][day][meal][item] = rating
        
    return feedback_dict

@app.post("/api/feedback/{reg}")
def save_feedback(reg: str, data: FeedbackSubmit):
    try:
        with get_db() as conn:
            # First, delete old feedback for this student/reg in this week to reflect full drops/modifications
            conn.execute(
                "DELETE FROM feedback WHERE reg = ? AND week_key = ?",
                (reg, data.week_key)
            )
            
            # Insert new ratings
            saved_count = 0
            for day, meals in data.feedback_data.items():
                for meal, items in meals.items():
                    for item, rating in items.items():
                        if rating:  # Only save valid ratings
                            conn.execute(
                                """
                                INSERT INTO feedback (reg, name, dept, week_key, day, meal, item, rating)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                """,
                                (reg, data.name, data.dept, data.week_key, day, meal, item, rating)
                            )
                            saved_count += 1
            conn.commit()
        return {"status": "success", "message": "Feedback saved successfully", "saved_ratings_count": saved_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save feedback: {str(e)}")

@app.post("/api/clear-all")
def clear_all():
    with get_db() as conn:
        conn.execute("DELETE FROM feedback")
        conn.execute("DELETE FROM menu")
        conn.commit()
    # Reset menu to default
    init_db()
    return {"status": "success", "message": "All database ratings cleared, menu reset to default"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)

