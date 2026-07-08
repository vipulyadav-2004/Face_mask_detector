import torch 
import torch.nn as nn

class FaceMaskCNN(nn.Module) :
    def __init__(self):
        super(FaceMaskCNN,self).__init__()
        self.conv1 = nn.Conv2d(in_channels=3,out_channels=32, kernel_size=3, padding=1)
        self.relu1 = nn.ReLU()
        self.pool1 = nn.MaxPool2d(kernel_size=2 , stride=2)

        self.conv2 = nn.Conv2d(32,64, kernel_size=3, padding=1)
        self.relu2 = nn.ReLU()
        self.pool2 = nn.MaxPool2d(2,2)

        self.fc1 = nn.Linear(64*32*32, 128)
        self.relu3 = nn.ReLU()
        self.fc2 = nn.Linear(128,2)

    def forward(self,x):
        x = self.pool1(self.relu1(self.conv1(x)))
        x = self.pool2(self.relu2(self.conv2(x)))
        x = x.view(-1, 64*32*32)
        x = self.relu3(self.fc1(x))
        x = self.fc2(x)
        return x 
