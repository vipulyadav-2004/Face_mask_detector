import cv2
import torch 
from  torchvision.transforms import transforms
from PIL import Image
from src.model import FaceMaskCNN

model = FaceMaskCNN()
model.load_state_dict(torch.load("face_mask_cnn.pth", map_location=torch.device('cpu')))
model.eval()

transform  = transforms.Compose([
    transforms.Resize((128,128)),
    transforms.ToTensor(),
    transforms.Normalize(mean = [0.485,0.456,0.406], std=[0.229,0.224,0.225])
])

face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

cap = cv2.VideoCapture(0)

while True:
    ret , frame  = cap.read()
    if not ret:
        break

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor = 1.1, minNeighbors=5, minSize= (60,60))

    for (x, y, w, h) in faces:
        face_roi = frame[y:y+h,x:x+w]

        rgb_face = cv2.cvtColor(face_roi, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb_face)

        input_tensor = transform(pil_img).unsqueeze(0)

        with torch.no_grad():
            outputs = model(input_tensor)
            label_idx = torch.argmax(outputs, dim=1).item()

        label  = "Mask" if label_idx == 1 else "No Mask"
        color = (0,255,0) if label_idx == 1 else (0,0,255)

        cv2.putText(frame,label,(x,y-10), cv2.FONT_HERSHEY_SIMPLEX,0.8,color,2)
        cv2.rectangle(frame, (x,y) , (x+w, y+h), color ,2)

    cv2.imshow('Real-Time Mask Detector' , frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break
cap.release()
cv2.destroyAllWindows()