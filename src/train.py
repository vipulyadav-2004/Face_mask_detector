import torch 
import torch.nn as nn 
import torch.optim as optim 
from torch.utils.data import DataLoader
from src.dataset import FaceMaskDataset
from src.model import FaceMaskCNN

def train_model(data_directory , epochs=10, batch_size = 32, lr = 0.001):

    dataset = FaceMaskDataset(data_directory)
    train_loader  = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    model = FaceMaskCNN()
    criterion = nn.CrossEntropyLoss()
    optimizer  = optim.Adam(model.parameters() , lr=lr)

    model.train()
    for epoch in range(epochs):
        running_loss = 0.0
        for images, labels in train_loader:
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)

            loss.backward()
            optimizer.step()

            running_loss += loss.item()

        print(f"🎬 Epoch [{epoch+1}/{epochs}] - Loss: {running_loss/len(train_loader):.4f}")

    torch.save(model.state_dict() , "face_mask_cnn.pth")
    print("model weights saved successfuly. ")

if __name__ == "__main__":
    train_model(data_directory="./data")