import os 
from PIL import Image
from torch.utils.data import Dataset
import torchvision.transforms as transforms

class FaceMaskDataset(Dataset):
    def __init__(self, data_dir):
        self.data_dir = data_dir
        self.image_paths = []
        self.labels = []

        self.transform = transforms.Compose([
            transforms.Resize((128, 128)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485 , 0.456, 0.406], std=[0.229 , 0.224, 0.225])

        ])

        for label_str ,label_idx in [('with_mask', 1), ('without_mask', 0)]:
            dir_path = os.path.join(data_dir , label_str)
            if os.path.exists(dir_path):
                for filename in os.listdir(dir_path):
                    if filename.lower().endswith(("png" , "jpg" , "jpeg")):
                        self.image_paths.append(os.path.join(dir_path,filename))
                        self.labels.append(label_idx)

    def __len__(self):
        return len(self.image_paths) 

    def __getitem__(self, idx):
        img_path =  self.image_paths[idx]
        image = Image.open(img_path).convert('RGB')
        label = self.labels[idx]

        if self.transform:
            image = self.transform(image)
            
        return image, label