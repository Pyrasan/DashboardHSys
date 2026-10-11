import json
import os
import ttkbootstrap as ttk
from ttkbootstrap.constants import *
from tkinter import filedialog, messagebox
from PIL import Image, ImageTk
import face_recognition

DATA_FILE = "R_data.json"
FACE_DIR = "Penduduk"
ENCODE_FILE = "R_encode.json"

os.makedirs(FACE_DIR, exist_ok=True)

if os.path.exists(DATA_FILE):
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        pendudukData = json.load(f)
else:
    pendudukData = {"penduduk": {}}

if os.path.exists(ENCODE_FILE):
    with open(ENCODE_FILE, "r", encoding="utf-8") as f:
        encode_data = json.load(f)
else:
    encode_data = {}


def save_data():
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(pendudukData, f, indent=4)


def save_encodings():
    with open(ENCODE_FILE, "w", encoding="utf-8") as f:
        json.dump(encode_data, f)


app = ttk.Window(
    title="Manajemen Penduduk - Sistem Keamanan",
    themename="darkly",
    size=(1250, 950)
)

main_frame = ttk.Frame(app, padding=10)
main_frame.pack(fill=BOTH, expand=True)

left_frame = ttk.Frame(main_frame)
left_frame.pack(side=LEFT, fill=BOTH, expand=True, padx=10)

right_frame = ttk.Frame(main_frame)
right_frame.pack(side=RIGHT, fill=Y, padx=10)

search_var = ttk.StringVar()

def search_data():
    keyword = search_var.get().lower()
    tree.delete(*tree.get_children())

    for pid, data in pendudukData["penduduk"].items():
        if keyword in data["nama"].lower():
            tree.insert("", END, values=(pid, data["nama"], len(data["plat_nomor"]), cek_foto(pid)))


ttk.Label(left_frame, text="Cari Penduduk", font=("Segoe UI", 12)).pack(anchor=W)

search_entry = ttk.Entry(left_frame, textvariable=search_var)
search_entry.pack(fill=X, pady=5)

ttk.Button(
    left_frame,
    text="Cari",
    bootstyle="primary",
    command=search_data
).pack(pady=5)


columns = ("ID", "Nama", "Jumlah Plat", "Gambar")

tree = ttk.Treeview(left_frame, columns=columns, show="headings", height=20)

for col in columns:
    tree.heading(col, text=col)
    tree.column(col, anchor=CENTER)

tree.pack(fill=BOTH, expand=True, pady=10)

ttk.Label(right_frame, text="Data Penduduk", font=("Segoe UI", 14, "bold")).pack(pady=10)

ttk.Label(right_frame, text="ID").pack(anchor=W)
entry_id = ttk.Entry(right_frame)
entry_id.pack(fill=X, pady=2)

ttk.Label(right_frame, text="Nama").pack(anchor=W)
entry_nama = ttk.Entry(right_frame)
entry_nama.pack(fill=X, pady=2)

ttk.Label(right_frame, text="Plat Kendaraan").pack(anchor=W, pady=(10,0))

plat_listbox = ttk.Treeview(right_frame, columns=("plat",), show="headings", height=5)
plat_listbox.heading("plat", text="Plat Nomor")
plat_listbox.pack(fill=X)

ttk.Label(right_frame, text="Plat Baru").pack(anchor=W, pady=(10,0))
entry_plat = ttk.Entry(right_frame)
entry_plat.pack(fill=X)

ttk.Label(right_frame, text="Foto Wajah").pack(pady=10)

image_label = ttk.Label(right_frame)
image_label.pack()

current_image = None

photo_frame = ttk.Frame(right_frame, padding=5)
photo_frame.pack()

image_label = ttk.Label(photo_frame)
image_label.pack()

def encode_wajah(img_path):
    from PIL import Image
    import numpy as np
    
    try:
        # Load image with PIL
        pil_img = Image.open(img_path)
        
        # Convert any mode to RGB
        if pil_img.mode != 'RGB':
            if pil_img.mode == 'P':
                pil_img = pil_img.convert('RGB')
            elif pil_img.mode in ('RGBA', 'LA'):
                background = Image.new('RGB', pil_img.size, (255, 255, 255))
                background.paste(pil_img, mask=pil_img.split()[-1] if pil_img.mode == 'RGBA' else None)
                pil_img = background
            else:
                pil_img = pil_img.convert('RGB')
        
        # Resize to reasonable size
        pil_img = pil_img.resize((640, 640), Image.LANCZOS)
        
        # Convert to numpy array and ensure uint8
        img = np.array(pil_img, dtype=np.uint8)
        
        # Ensure 3 channels (RGB)
        if len(img.shape) == 2:
            # Grayscale - convert to RGB
            img = np.stack([img, img, img], axis=-1)
        elif len(img.shape) == 3 and img.shape[2] == 4:
            # RGBA - convert to RGB
            img = img[:, :, :3]
        
        # Verify final format for face_recognition
        if img.dtype != np.uint8 or len(img.shape) != 3 or img.shape[2] != 3:
            print(f"Invalid image format: dtype={img.dtype}, shape={img.shape}")
            return None
        
        # face_recognition needs (height, width, channels)
        encodings = face_recognition.face_encodings(img)
        if len(encodings) == 0:
            return None
        return encodings[0].tolist()
    except Exception as e:
        print(f"Error encoding face: {e}")
        return None

def display_image(pid):
    if pid not in pendudukData["penduduk"]:
        return
    nama = pendudukData["penduduk"][pid]["nama"]
    filename = f"{pid} - {nama}.jpg"
    img_path = os.path.join(FACE_DIR, filename)
    if os.path.exists(img_path):
        img = Image.open(img_path)
        img = img.resize((160,160))
        photo = ImageTk.PhotoImage(img)
        image_label.configure(image=photo)
        image_label.image = photo
    else:
        image_label.configure(image="")
        image_label.image = None

def select_item(event):
    selected = tree.selection()
    if not selected:
        return
    item = tree.item(selected[0])
    pid = str(item["values"][0])
    data = pendudukData["penduduk"][pid]
    entry_id.delete(0, END)
    entry_id.insert(0, pid)
    entry_nama.delete(0, END)
    entry_nama.insert(0, data["nama"])
    plat_listbox.delete(*plat_listbox.get_children())
    for p in data["plat_nomor"]:
        plat_listbox.insert("", END, values=(p,))
    display_image(pid)


tree.bind("<<TreeviewSelect>>", select_item)

def cek_foto(pid):
    if pid not in pendudukData["penduduk"]:
        return "Tidak Ada"
    nama = pendudukData["penduduk"][pid]["nama"]
    filename = f"{pid} - {nama}.jpg"
    path = os.path.join(FACE_DIR, filename)
    if os.path.exists(path):
        return "Ada"
    else:
        return "Tidak Ada"

def update_table():
    tree.delete(*tree.get_children())
    for pid, data in pendudukData["penduduk"].items():
        status_foto = cek_foto(pid)
        tree.insert("", END, values=(pid, data["nama"], len(data["plat_nomor"]), status_foto))


def add_penduduk():
    pid = str(entry_id.get().strip())
    nama = entry_nama.get().strip()
    if not pid or not nama:
        messagebox.showerror("Error", "ID dan Nama wajib diisi")
        return
    if pid in pendudukData["penduduk"]:
        messagebox.showerror("Error", "ID sudah ada")
        return
    pendudukData["penduduk"][pid] = {
        "nama": nama,
        "plat_nomor": []
    }
    save_data()
    update_table()

def update_penduduk():
    pid = str(entry_id.get())
    if pid not in pendudukData["penduduk"]:
        return
    pendudukData["penduduk"][pid]["nama"] = entry_nama.get()
    save_data()
    update_table()

def delete_penduduk():
    pid = str(entry_id.get())
    if pid in pendudukData["penduduk"]:
        if messagebox.askyesno("Konfirmasi", "Hapus data ini?"):
            del pendudukData["penduduk"][pid]
            if pid in encode_data:
                del encode_data[pid]
                save_encodings()
            save_data()
            update_table()

def tambah_plat():
    pid = str(entry_id.get())
    if pid not in pendudukData["penduduk"]:
        return
    plat = entry_plat.get().upper().strip()
    if not plat:
        return
    if plat not in pendudukData["penduduk"][pid]["plat_nomor"]:
        pendudukData["penduduk"][pid]["plat_nomor"].append(plat)
        plat_listbox.insert("", END, values=(plat,))
        entry_plat.delete(0, END)
        save_data()
        update_table()

def hapus_plat():
    pid = str(entry_id.get())
    selected = plat_listbox.selection()
    if not selected:
        return
    item = plat_listbox.item(selected[0])
    plat = item["values"][0]
    pendudukData["penduduk"][pid]["plat_nomor"].remove(plat)
    plat_listbox.delete(selected[0])
    save_data()
    update_table()

def upload_image():
    pid = str(entry_id.get())
    nama = entry_nama.get().strip()
    if not pid or not nama:
        messagebox.showerror("Error", "Isi ID dan Nama terlebih dahulu")
        return
    file = filedialog.askopenfilename(filetypes=[("Image files", "*.jpg *.jpeg *.png"), ("All files", "*.*")])
    if not file:
        return
    filename = f"{pid} - {nama}.jpg"
    dest = os.path.join(FACE_DIR, filename)
    
    # Open and convert to RGB before saving (handle all formats)
    img = Image.open(file)
    if img.mode in ('RGBA', 'LA', 'P'):
        if img.mode == 'RGBA' or img.mode == 'LA':
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        else:
            img = img.convert('RGB')
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    img.save(dest)
    
    encoding = encode_wajah(dest)
    if encoding is None:
        messagebox.showerror("Error", "Wajah tidak terdeteksi!")
        return
    encode_data[pid] = encoding
    save_encodings()
    messagebox.showinfo("Sukses", "Foto dan encoding wajah berhasil disimpan")
    display_image(pid)
    update_table()

btn_frame = ttk.Frame(right_frame)
btn_frame.pack(pady=10)

ttk.Button(
    btn_frame,
    text="Tambah Plat",
    bootstyle="success",
    command=tambah_plat
).pack(side=LEFT, padx=5)

ttk.Button(
    btn_frame,
    text="Hapus Plat",
    bootstyle="danger",
    command=hapus_plat
).pack(side=LEFT, padx=5)


ttk.Button(
    right_frame,
    text="Tambah Penduduk",
    bootstyle="success",
    command=add_penduduk
).pack(fill=X, pady=5)

ttk.Button(
    right_frame,
    text="Update",
    bootstyle="warning",
    command=update_penduduk
).pack(fill=X)

ttk.Button(
    right_frame,
    text="Hapus",
    bootstyle="danger",
    command=delete_penduduk
).pack(fill=X)

ttk.Button(
    right_frame,
    text="Upload Foto",
    bootstyle="info",
    command=upload_image
).pack(fill=X, pady=10)


update_table()

app.mainloop()
